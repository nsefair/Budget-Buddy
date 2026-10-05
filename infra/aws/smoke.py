#!/usr/bin/env python3
"""Run on the pilot host. Creates and removes only its own synthetic user; sends no mail.
Set CHECK_PLAID_LINK_TOKEN=1 to also check token creation (never creates a real Item).
"""
import datetime,json,os,secrets,subprocess,urllib.request,urllib.error
base='https://api.budgetbudd.com'
def sql(query):
 r=subprocess.run(['docker','exec','-i','budget-buddy-pilot-db-1','psql','-U','budget_buddy','-d','budget_buddy','-tA','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('Smoke SQL failed: '+r.stderr)
 return r.stdout.strip().splitlines()[0]
def request(path,body=None,method=None,token=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(base+path,None if body is None else json.dumps(body).encode(),headers,method=method)
 with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
password=secrets.token_urlsafe(32);email='deployment-smoke-'+secrets.token_hex(8)+'@example.invalid'
user=sql("insert into users(email,password_hash,first_name,email_verified_at) values ('"+email+"',crypt('"+password+"',gen_salt('bf')),'Deployment check',now()) returning id;")
try:
 assert request('/readyz')['status']=='ready'
 auth=request('/v1/auth/login',{'email':email,'password':password})
 token=auth.get('accessToken') or auth.get('tokens',{}).get('accessToken')
 assert token,'login response missing access token'
 status=request('/v1/plaid/status',token=token)
 assert status['configured'] and status['encryptionConfigured'] and status['environment']=='production'
 if os.environ.get('CHECK_PLAID_LINK_TOKEN')=='1':
  linked=request('/v1/plaid/link-token',{},token=token)
  assert linked['linkToken'].startswith('link-production-')
 today=datetime.datetime.now(datetime.timezone.utc).date();yesterday=today-datetime.timedelta(days=1);end=today+datetime.timedelta(days=13)
 profile={'timezone':'UTC','startDate':str(yesterday),'sources':[{'id':'job','amountCents':140000,'periodDays':14,'nextArrival':str(end)}],'bills':[],'goalMonthlyCents':0}
 request('/v1/money/profile',profile,method='PUT',token=token)
 first=request('/v1/money/today',token=token)['result']
 expense={'clientId':'smoke-expense-unique','amountCents':1700,'cash':True}
 second=request('/v1/money/spending',expense,token=token)['result']
 retry=request('/v1/money/spending',expense,token=token)['result']
 assert second['morningCents']==first['morningCents'] and second['remainingCents']==first['remainingCents']-1700
 assert retry==second,'manual expense retry was not idempotent'
 goal=sql("insert into goals(user_id,name,kind,duration,target_amount_cents,deadline) values('"+user+"','Smoke goal','savings_target','medium',100000,now()+interval '1 year') returning id;")
 sql("insert into money_daily_snapshots(user_id,date,timezone,cycle_start,version,morning_cents,morning_inputs,latest_result) values('"+user+"','"+str(yesterday)+"','UTC','"+str(yesterday)+"','safe-to-spend-v1',5000,'{}','{}'); select 1;")
 move=request('/v1/money/yesterday/allocate',{'goalId':goal},token=token)
 again=request('/v1/money/yesterday/allocate',{'goalId':goal},token=token)
 assert move['allocatedCents']==5000 and not move['alreadyAllocated'] and again['alreadyAllocated']
 assert sql("select already_saved_cents from goals where id='"+goal+"';")=='5000'
 # Confirm income edits update the stored result without resetting the morning.
 profile['sources'][0]['amountCents']=280000
 edited=request('/v1/money/profile',profile,method='PUT',token=token)['today']['result']
 assert edited['inputs']['cycle']['incomeCents']==280000 and edited['morningCents']==first['morningCents']
 # Synthetic ledger rows exercise the hosted Budget API; no Plaid call or bank Item is created.
 item=sql("insert into plaid_items(user_id,plaid_item_id,access_token_ciphertext,last_sync_at) values('"+user+"','smoke-"+user+"','synthetic-test-only',now()) returning id;")
 account=sql("insert into plaid_accounts(user_id,item_id,plaid_account_id,name,type,subtype,iso_currency_code) values('"+user+"','"+item+"','smoke-account-"+user+"','Synthetic checking','depository','checking','USD') returning id;")
 for name,cents,primary,detailed,pending in [('payroll',-100000,'INCOME','INCOME_WAGES',False),('food',1000,'FOOD_AND_DRINK','FOOD_AND_DRINK_GROCERIES',True),('zelle',5000,'TRANSFER_OUT','TRANSFER_OUT_OTHER_TRANSFER_OUT',False)]:
  sql("insert into plaid_transactions(user_id,item_id,account_id,plaid_transaction_id,name,amount_cents,date,iso_currency_code,personal_finance_category_primary,personal_finance_category_detailed,pending) values('"+user+"','"+item+"','"+account+"','smoke-"+name+user+"','"+name+"',"+str(cents)+",'"+str(today)+"','USD','"+primary+"','"+detailed+"',"+str(pending).lower()+"); select 1;")
 overview=request('/v1/budget/overview?month='+str(today)[:7],token=token)
 assert overview['income']==1000 and overview['totalSpent']==60
 assert next(c for c in overview['categories'] if c['id']=='uncategorized')['spent']==50
 receipts=request('/v1/budget/transactions?month='+str(today)[:7]+'&category=food',token=token)
 assert len(receipts)==1 and receipts[0]['isPending'] and receipts[0]['amount']==10
 transactions=request('/v1/budget/transactions?month='+str(today)[:7],token=token)
 assert any(t['categoryId']=='income' and t['amount']==-1000 for t in transactions)
 updated=request('/v1/money/today',token=token)['result']
 assert updated['morningCents']==first['morningCents'] and updated['inputs']['spentTodayCents']==7700
 print('PASS: HTTPS, auth, persisted income edits, fixed morning, manual-entry retries, goal allocation, bank income, pending spending and Uncategorized category drill-down.')
 print('OAuth configured:',status['oauthConfigured'])
finally:
 sql("delete from users where id='"+user+"'; select 1;")
 print('Synthetic test user removed.')

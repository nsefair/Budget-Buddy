#!/usr/bin/env python3
"""Run on the pilot host. Creates and removes only its own synthetic user; sends no mail.
Checks production Link-token creation without creating a real bank Item.
"""
import datetime,json,secrets,subprocess,urllib.request,urllib.error
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
 print('PASS: HTTPS readiness, login, production Plaid token (no Item), stored morning number, instant manual spending, idempotent expense and goal allocation.')
 print('OAuth configured:',status['oauthConfigured'])
finally:
 sql("delete from users where id='"+user+"'; select 1;")
 print('Synthetic test user removed.')

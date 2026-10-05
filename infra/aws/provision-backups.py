import subprocess,json,pathlib
from guard import verify
verify('455012390237', 'budget-buddy', 'us-east-2')
aws=['aws','--profile','budget-buddy','--region','us-east-2']
def run(*args):return subprocess.check_output(aws+list(args),text=True)
bucket='budget-buddy-pilot-backups-455012390237'
existing=subprocess.run(aws+['s3api','head-bucket','--bucket',bucket],capture_output=True)
if existing.returncode:run('s3api','create-bucket','--bucket',bucket,'--create-bucket-configuration','LocationConstraint=us-east-2')
run('s3api','put-public-access-block','--bucket',bucket,'--public-access-block-configuration',json.dumps(dict.fromkeys(['BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets'],True)))
run('s3api','put-bucket-encryption','--bucket',bucket,'--server-side-encryption-configuration',json.dumps({'Rules':[{'ApplyServerSideEncryptionByDefault':{'SSEAlgorithm':'AES256'}}]}))
run('s3api','put-bucket-lifecycle-configuration','--bucket',bucket,'--lifecycle-configuration',json.dumps({'Rules':[{'ID':'ExpirePilotBackups','Status':'Enabled','Filter':{'Prefix':'database/'},'Expiration':{'Days':14},'AbortIncompleteMultipartUpload':{'DaysAfterInitiation':1}}]}))
run('s3api','put-bucket-policy','--bucket',bucket,'--policy',json.dumps({'Version':'2012-10-17','Statement':[{'Sid':'TLSOnly','Effect':'Deny','Principal':'*','Action':'s3:*','Resource':['arn:aws:s3:::'+bucket,'arn:aws:s3:::'+bucket+'/*'],'Condition':{'Bool':{'aws:SecureTransport':'false'}}}]}))
role=run('cloudformation','describe-stack-resource','--stack-name','budget-buddy-pilot','--logical-resource-id','ServerRole','--query','StackResourceDetail.PhysicalResourceId','--output','text').strip()
policy={'Version':'2012-10-17','Statement':[{'Effect':'Allow','Action':['s3:PutObject','s3:GetObject'],'Resource':'arn:aws:s3:::'+bucket+'/database/*'}]}
run('iam','put-role-policy','--role-name',role,'--policy-name','PilotDatabaseBackups','--policy-document',json.dumps(policy))
print('Private encrypted bucket ready with 14-day retention and database-only instance permissions.')

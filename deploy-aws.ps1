# NekoLive Production Deployment
# PowerShell script for Windows deployment preparation

param(
    [string]$Domain = "nekolive.app",
    [string]$Region = "us-east-1",
    [string]$InstanceType = "t3.small"
)

Write-Host "🚀 NekoLive AWS Deployment Preparation" -ForegroundColor Green
Write-Host "Domain: $Domain" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Instance Type: $InstanceType" -ForegroundColor Yellow

# Check AWS CLI
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
    Write-Host "Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Check AWS credentials
try {
    aws sts get-caller-identity | Out-Null
    Write-Host "✅ AWS credentials configured" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Pre-deployment Checklist:" -ForegroundColor Cyan

# 1. Create S3 bucket for static assets
$bucketName = "nekolive-static-$((Get-Random).ToString().Substring(0,6))"
Write-Host "1. Creating S3 bucket: $bucketName" -ForegroundColor Yellow

try {
    aws s3 mb "s3://$bucketName" --region $Region
    Write-Host "   ✅ S3 bucket created successfully" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to create S3 bucket" -ForegroundColor Red
}

# 2. Create security group
Write-Host "2. Creating security group..." -ForegroundColor Yellow
$sgId = aws ec2 create-security-group --group-name "nekolive-sg" --description "Security group for NekoLive WebRTC app" --region $Region --query 'GroupId' --output text

if ($sgId) {
    Write-Host "   ✅ Security group created: $sgId" -ForegroundColor Green
    
    # Add rules
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 22 --cidr 0.0.0.0/0 --region $Region
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $Region  
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 443 --cidr 0.0.0.0/0 --region $Region
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 8080 --cidr 0.0.0.0/0 --region $Region
    
    Write-Host "   ✅ Security group rules added" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to create security group" -ForegroundColor Red
}

# 3. Create key pair
Write-Host "3. Creating EC2 key pair..." -ForegroundColor Yellow
$keyName = "nekolive-key"

try {
    aws ec2 create-key-pair --key-name $keyName --region $Region --query 'KeyMaterial' --output text | Out-File -FilePath "$keyName.pem" -Encoding utf8
    Write-Host "   ✅ Key pair created: $keyName.pem" -ForegroundColor Green
    Write-Host "   ⚠️  Keep this file secure!" -ForegroundColor Red
} catch {
    Write-Host "   ❌ Failed to create key pair (may already exist)" -ForegroundColor Yellow
}

# 4. Create user data script
Write-Host "4. Creating user data script..." -ForegroundColor Yellow

$userData = @"
#!/bin/bash
yum update -y
yum install -y git nginx

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install PM2
npm install -g pm2

# Clone repository (replace with your repo URL)
cd /home/ec2-user
git clone https://github.com/RohanQ17/NekoLive-WebRTC.git
cd NekoLive-WebRTC

# Install dependencies
npm ci --only=production

# Setup environment
cp .env.example .env
sed -i 's/NODE_ENV=development/NODE_ENV=production/' .env
sed -i 's/ALLOWED_ORIGINS=\*/ALLOWED_ORIGINS=https:\/\/$Domain/' .env

# Start application
pm2 start signaling-server.js --name nekolive
pm2 startup amazon-linux
pm2 save

# Configure nginx
cat > /etc/nginx/conf.d/nekolive.conf << 'EOL'
server {
    listen 80;
    server_name $Domain;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

systemctl enable nginx
systemctl start nginx
"@

$userData | Out-File -FilePath "user-data.sh" -Encoding utf8
Write-Host "   ✅ User data script created: user-data.sh" -ForegroundColor Green

# 5. Create CloudFormation template
Write-Host "5. Creating CloudFormation template..." -ForegroundColor Yellow

$cfTemplate = @"
{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "NekoLive WebRTC Application Infrastructure",
  "Parameters": {
    "Domain": {
      "Type": "String",
      "Default": "$Domain",
      "Description": "Domain name for the application"
    },
    "InstanceType": {
      "Type": "String", 
      "Default": "$InstanceType",
      "Description": "EC2 instance type"
    },
    "KeyName": {
      "Type": "String",
      "Default": "$keyName",
      "Description": "EC2 Key Pair name"
    }
  },
  "Resources": {
    "NekoLiveInstance": {
      "Type": "AWS::EC2::Instance",
      "Properties": {
        "ImageId": "ami-0c02fb55956c7d316",
        "InstanceType": {"Ref": "InstanceType"},
        "KeyName": {"Ref": "KeyName"},
        "SecurityGroupIds": ["$sgId"],
        "UserData": {
          "Fn::Base64": {"Fn::Sub": [
            "$(cat user-data.sh)",
            {}
          ]}
        },
        "Tags": [
          {"Key": "Name", "Value": "NekoLive-WebRTC"},
          {"Key": "Application", "Value": "NekoLive"}
        ]
      }
    },
    "NekoLiveS3Bucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": {
        "BucketName": "$bucketName",
        "PublicAccessBlockConfiguration": {
          "BlockPublicAcls": false,
          "BlockPublicPolicy": false,
          "IgnorePublicAcls": false,
          "RestrictPublicBuckets": false
        },
        "WebsiteConfiguration": {
          "IndexDocument": "main.html"
        }
      }
    },
    "NekoLiveCloudFront": {
      "Type": "AWS::CloudFront::Distribution",
      "Properties": {
        "DistributionConfig": {
          "Origins": [{
            "DomainName": {"Fn::GetAtt": ["NekoLiveS3Bucket", "DomainName"]},
            "Id": "S3Origin",
            "S3OriginConfig": {}
          }],
          "DefaultCacheBehavior": {
            "TargetOriginId": "S3Origin",
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": ["GET", "HEAD"],
            "CachedMethods": ["GET", "HEAD"],
            "ForwardedValues": {"QueryString": false}
          },
          "Enabled": true,
          "DefaultRootObject": "main.html"
        }
      }
    }
  },
  "Outputs": {
    "InstancePublicIP": {
      "Description": "Public IP of the EC2 instance",
      "Value": {"Fn::GetAtt": ["NekoLiveInstance", "PublicIp"]}
    },
    "S3BucketName": {
      "Description": "Name of the S3 bucket",
      "Value": {"Ref": "NekoLiveS3Bucket"}
    },
    "CloudFrontURL": {
      "Description": "CloudFront distribution URL",
      "Value": {"Fn::GetAtt": ["NekoLiveCloudFront", "DomainName"]}
    }
  }
}
"@

$cfTemplate | Out-File -FilePath "cloudformation-template.json" -Encoding utf8
Write-Host "   ✅ CloudFormation template created" -ForegroundColor Green

# 6. Create deployment instructions
Write-Host "6. Creating deployment instructions..." -ForegroundColor Yellow

$instructions = @"
# NekoLive AWS Deployment Instructions

## Quick Deploy with CloudFormation

1. Deploy the stack:
   aws cloudformation create-stack --stack-name nekolive-stack --template-body file://cloudformation-template.json --region $Region

2. Wait for completion:
   aws cloudformation wait stack-create-complete --stack-name nekolive-stack --region $Region

3. Get outputs:
   aws cloudformation describe-stacks --stack-name nekolive-stack --region $Region --query 'Stacks[0].Outputs'

## Manual Deployment

1. Launch EC2 instance:
   aws ec2 run-instances --image-id ami-0c02fb55956c7d316 --count 1 --instance-type $InstanceType --key-name $keyName --security-group-ids $sgId --user-data file://user-data.sh --region $Region

2. Upload static files to S3:
   aws s3 sync . s3://$bucketName --exclude "*.js" --exclude "node_modules/*" --exclude ".env*"

3. Configure Route 53 (if using):
   - Create hosted zone for $Domain
   - Point A record to EC2 public IP
   - Point CNAME for www to CloudFront distribution

## SSL Setup (on EC2 instance)

1. SSH into the instance:
   ssh -i $keyName.pem ec2-user@<INSTANCE_IP>

2. Install certbot:
   sudo amazon-linux-extras install epel
   sudo yum install certbot python3-certbot-nginx

3. Get SSL certificate:
   sudo certbot --nginx -d $Domain

## Monitoring Setup

1. CloudWatch Logs:
   - Install CloudWatch agent on EC2
   - Monitor /var/log/pm2/*.log

2. Application monitoring:
   - Use health check endpoint: http://<IP>:8080/health
   - Set up CloudWatch alarms for CPU/memory

## Security Hardening

1. Update security group:
   - Remove port 8080 from public access
   - Only allow nginx (80/443)

2. Setup fail2ban:
   sudo yum install fail2ban
   sudo systemctl enable fail2ban

3. Regular updates:
   sudo yum update -y

## Scaling Considerations

- Use Application Load Balancer for multiple instances
- Set up Auto Scaling Group
- Consider using ECS/EKS for container orchestration
- Add Redis for session sharing across instances

## Backup Strategy

- Daily EBS snapshots
- S3 cross-region replication
- Database backups (if added later)

## Cost Optimization

- Use Reserved Instances for production
- Set up CloudWatch billing alerts
- Use S3 lifecycle policies
- Consider Spot Instances for development
"@

$instructions | Out-File -FilePath "deployment-instructions.md" -Encoding utf8
Write-Host "   ✅ Deployment instructions created" -ForegroundColor Green

Write-Host "`n🎉 AWS deployment preparation completed!" -ForegroundColor Green
Write-Host "`nFiles created:" -ForegroundColor Cyan
Write-Host "  📄 cloudformation-template.json" -ForegroundColor White
Write-Host "  📄 user-data.sh" -ForegroundColor White  
Write-Host "  📄 deployment-instructions.md" -ForegroundColor White
Write-Host "  🔑 $keyName.pem" -ForegroundColor White

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Review and customize the CloudFormation template" -ForegroundColor White
Write-Host "  2. Update the git repository URL in user-data.sh" -ForegroundColor White
Write-Host "  3. Deploy with: aws cloudformation create-stack --stack-name nekolive-stack --template-body file://cloudformation-template.json --region $Region" -ForegroundColor White
Write-Host "  4. Follow deployment-instructions.md for complete setup" -ForegroundColor White

Write-Host "`n⚠️  Security reminders:" -ForegroundColor Yellow
Write-Host "  - Keep $keyName.pem file secure and private" -ForegroundColor Red
Write-Host "  - Update the default domain name in templates" -ForegroundColor Red
Write-Host "  - Configure proper DNS records for your domain" -ForegroundColor Red
Write-Host "  - Set up SSL certificates after deployment" -ForegroundColor Red

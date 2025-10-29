# Google Cloud Run Deployment Guide

This guide will help you deploy your Constella application to Google Cloud Run with 0.5 CPU and 1GB RAM.

## Prerequisites

1. **Google Cloud Account**: Make sure you have a Google Cloud account and billing enabled
2. **Google Cloud CLI**: Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
3. **Docker**: Install [Docker](https://docs.docker.com/get-docker/) for local testing

## Setup

1. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable required APIs**:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

## Deployment Options

### Option 1: Deploy with Cloud Build (Recommended)

This builds and deploys your application using Google Cloud Build:

```bash
npm run gcloud:build
```

### Option 2: Deploy directly from source

This builds and deploys directly from your source code:

```bash
npm run gcloud:deploy
```

### Option 3: Manual deployment

1. **Build the Docker image locally** (optional for testing):
   ```bash
   npm run docker:build
   npm run docker:run
   ```

2. **Deploy using service.yaml**:
   ```bash
   # First, update PROJECT_ID in service.yaml
   gcloud run services replace service.yaml --region=us-central1
   ```

## Configuration

### Resource Limits
- **CPU**: 0.5 vCPU
- **Memory**: 1GB RAM
- **Timeout**: 300 seconds
- **Concurrency**: 1000 requests per instance
- **Max Instances**: 10

### Environment Variables
The application will run with:
- `NODE_ENV=production`
- `PORT=3000`

### Health Checks
- **Liveness Probe**: Checks `/` endpoint every 10 seconds
- **Readiness Probe**: Checks `/` endpoint every 5 seconds

## Customization

### Change Region
Update the region in `service.yaml` and `cloudbuild.yaml`:
```yaml
region: us-central1  # Change to your preferred region
```

### Change Resource Limits
Update the resources in `service.yaml`:
```yaml
resources:
  limits:
    cpu: "0.5"      # Change CPU limit
    memory: "1Gi"   # Change memory limit
```

### Add Environment Variables
Add environment variables in `service.yaml`:
```yaml
env:
- name: NODE_ENV
  value: production
- name: YOUR_VAR
  value: your_value
```

## Monitoring

After deployment, you can monitor your service in the Google Cloud Console:
1. Go to Cloud Run in the Google Cloud Console
2. Click on your `constella` service
3. View logs, metrics, and manage the service

## Troubleshooting

### Common Issues

1. **Build fails**: Check that all dependencies are in `package.json`
2. **Service won't start**: Check the logs in Cloud Run console
3. **Out of memory**: Increase memory limit in `service.yaml`
4. **Timeout errors**: Increase timeout in `service.yaml`

### Useful Commands

```bash
# View service logs
gcloud run services logs read constella --region=us-central1

# Update service
gcloud run services update constella --region=us-central1

# Delete service
gcloud run services delete constella --region=us-central1
```

## Cost Optimization

- The service scales to zero when not in use
- You only pay for actual usage
- Consider using Cloud Run's minimum instances setting if you need consistent performance

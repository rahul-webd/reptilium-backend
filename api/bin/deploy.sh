PROJECT_ID="reptilium-3e457"
IMAGE=gcr.io/${PROJECT_ID}/api

gcloud builds submit --tag $IMAGE && \
gcloud run deploy --image $IMAGE
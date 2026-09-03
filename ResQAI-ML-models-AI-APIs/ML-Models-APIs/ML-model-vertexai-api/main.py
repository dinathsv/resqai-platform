from typing import Dict
from google.cloud import aiplatform
from google.protobuf import json_format
from google.protobuf.struct_pb2 import Value
from dotenv import load_dotenv
import os


load_dotenv()

#save the key file in the same directory as the code and add the file name to the .env file
GOOGLE_CREDENTIAL_FILE=os.getenv("GOOGLE_CREDENTIAL_FILE")
PROJECT_ID=os.getenv("PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GOOGLE_CREDENTIAL_FILE
def predict_tabular_classification_sample(
    project: str,
    endpoint_id: str,
    instance_dict: Dict,
    location: str = "us-central1",
    api_endpoint: str = "us-central1-aiplatform.googleapis.com",
):
    # The AI Platform services require regional API endpoints.
    client_options = {"api_endpoint": api_endpoint}
    # Initialize client to create and send requests.
    client = aiplatform.gapic.PredictionServiceClient(client_options=client_options)
    
    # Parse the instance dictionary into the appropriate format
    instance = json_format.ParseDict(instance_dict, Value())
    instances = [instance]
    parameters_dict = {}  # Add any parameters if required
    parameters = json_format.ParseDict(parameters_dict, Value())
    
    # Create endpoint path
    endpoint = client.endpoint_path(
        project=project, location=location, endpoint=endpoint_id
    )
    
    # Send prediction request
    response = client.predict(
        endpoint=endpoint, instances=instances, parameters=parameters
    )
    
    # Output the response
    print("Response:")
    print("Deployed Model ID:", response.deployed_model_id)
    for prediction in response.predictions:
        print("Prediction:", dict(prediction))


# Replace with your project and endpoint details
if __name__ == "__main__":
    predict_tabular_classification_sample(
        project="project id",  # Your Google Cloud Project ID
        endpoint_id="endpoint id",  # Your Endpoint ID
        location="us-central1", # default location
        instance_dict={
            "feature1": "value1",
            "feature2": "value2",
            "feature3": "value3",
            "feature4": "value4",
        }
    )

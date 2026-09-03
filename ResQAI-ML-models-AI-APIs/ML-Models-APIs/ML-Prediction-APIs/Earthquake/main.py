from typing import Dict
from google.cloud import aiplatform
from google.protobuf import json_format
from google.protobuf.struct_pb2 import Value
from dotenv import load_dotenv
from flask import Flask, request, jsonify
import vertexai
from vertexai.generative_models import (
    GenerationConfig,
    GenerativeModel,
    Tool,
    grounding,
)
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)


load_dotenv()

GOOGLE_CREDENTIAL_FILE = os.getenv("GOOGLE_CREDENTIAL_FILE")
PROJECT_ID = os.getenv("PROJECT_ID")
ENDPOINT_ID = os.getenv("ENDPOINT_ID")
LOCATION = "us-central1"
API_ENDPOINT = "us-central1-aiplatform.googleapis.com"
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GOOGLE_CREDENTIAL_FILE


model = GenerativeModel(
            model_name="gemini-1.5-pro-001",
        )
tool = Tool.from_google_search_retrieval(grounding.GoogleSearchRetrieval())



def predict_tabular_classification(
    instance_dict: Dict,
):
    
    client_options = {"api_endpoint": API_ENDPOINT}
    
    client = aiplatform.gapic.PredictionServiceClient(client_options=client_options)

    # Parse the instance dictionary into the appropriate format
    instance = json_format.ParseDict(instance_dict, Value())
    instances = [instance]
    parameters_dict = {}  # Add any parameters if required
    parameters = json_format.ParseDict(parameters_dict, Value())

   
    endpoint = client.endpoint_path(
        project=PROJECT_ID, location=LOCATION, endpoint=ENDPOINT_ID
    )

    # Send prediction request
    response = client.predict(
        endpoint=endpoint, instances=instances, parameters=parameters
    )

    # Format the response
    predictions = [dict(prediction) for prediction in response.predictions]
    return {
        "deployed_model_id": response.deployed_model_id,
        "predictions": predictions,
    }

@app.route("/predict", methods=["POST"])
def predict():
    try:
        
        instance_dict = request.get_json()
        if not instance_dict:
            return jsonify({"error": "Invalid input, JSON body required."}), 400
        

        # Call the prediction function
        result = predict_tabular_classification(instance_dict=instance_dict)
        predictions  = result["predictions"][0]
        PROMPT=f'''
            You are an advanced AI tasked with generating human-readable insights based on a machine learning earthquake prediction model. Use the provided input and output data, along with contextual information about the region, to generate a detailed report. Additionally, include a severity assessment based on predefined metrics and provide actionable recommendations.

            ### Input Data:
            - **Timestamp**: {instance_dict["Timestamp"]}  
            - **Latitude**: {instance_dict["Latitude"]}  
            - **Longitude**: {instance_dict["Longitude"]}  
            - **Depth (km)**: {instance_dict["Depth"]}  
            - **Location**: {instance_dict["Location"]}  

            ### Model Output:
            - **Predicted Magnitude (Value)**: {predictions["value"]}  
            - **Lower Bound**: {predictions["lower_bound"]}  
            - **Upper Bound**: {predictions["upper_bound"]}  

            ### Severity Assessment Metrics:
            - If the magnitude is less than 3.0, it is classified as **Not Serious**.  
            - If the magnitude is between 3.0 and 5.0, it is classified as **Moderate**.  
            - If the magnitude is greater than or equal to 5.0, it is classified as **Severe**.

            ### Severity Assessment:
            Based on the predicted magnitude ({predictions["value"]}), determine the earthquake's severity and explain its implications.

            ### Historical Context:
            Provide an overview of past earthquake events near "{instance_dict["Location"]}" based on latitude ({instance_dict["Latitude"]}) and longitude ({instance_dict["Longitude"]}). Include details about their magnitude, impact, and any recovery efforts.

            ### Insights and Recommendations:
            1. **Explanation**: Provide a clear explanation of the predicted earthquake magnitude and its severity based on the input data.  
            2. **Historical Context**: Discuss past earthquake events in the region and how they relate to the current prediction.  
            3. **Recommendations**: Suggest precautionary steps and immediate actions to minimize damage and ensure safety based on the predicted severity.  

            ### Recent Developments:
            Include recent news related to "{instance_dict["Location"]}" regarding earthquakes, seismic activities, or disaster management efforts.

            ### Output Format:
            Generate a structured, human-readable report with the following format:

            #### Earthquake Prediction Insights for {instance_dict["Location"]}
            - **Timestamp**: {instance_dict["Timestamp"]}  
            - **Predicted Magnitude**: {predictions["value"]}  
            - **Severity**: [Determined severity based on the magnitude]  
            - **Explanation**:  
              [Detailed explanation of the prediction based on input data.]

            - **Historical Earthquake Context**:  
              [Overview of past earthquake events near this region.]

            - **Recommendations**:  
              - [Recommendation 1]  
              - [Recommendation 2]  

            - **Recent News Highlights**:  
              1. [News 1]  
              2. [News 2]

            Ensure the report is informative, easy to understand, and provides actionable insights.
            '''
        response = model.generate_content(
            PROMPT,
            tools=[tool],
            generation_config=GenerationConfig(
            temperature=0.0
            ),
        )
        model_reply = response.text

        return jsonify({'response': model_reply,
                        'ml_output': predictions
                        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

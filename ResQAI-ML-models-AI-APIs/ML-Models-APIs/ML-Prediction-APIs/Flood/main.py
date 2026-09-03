from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
from sklearn.preprocessing import LabelEncoder
import vertexai
from vertexai.generative_models import (
    GenerationConfig,
    GenerativeModel,
    Tool,
    grounding,
)
from flask_cors import CORS
from dotenv import load_dotenv
import os

app = Flask(__name__)
CORS(app)
load_dotenv()

GOOGLE_CREDENTIAL_FILE=os.getenv("GOOGLE_CREDENTIAL_FILE")
PROJECT_ID=os.getenv("PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GOOGLE_CREDENTIAL_FILE
vertexai.init(project=PROJECT_ID, location="us-central1")

ML_MODEL = joblib.load("models/decision_tree_model.joblib")
subdiv_encoder = joblib.load("models/subdiv_encoder.joblib")

model = GenerativeModel(
            model_name="gemini-1.5-pro-001",
        )
tool = Tool.from_google_search_retrieval(grounding.GoogleSearchRetrieval())

def preprocess_input(data):
    """Preprocess the input data by encoding and normalizing."""
  
    if data["SUBDIVISIONS"] in subdiv_encoder.classes_:
        data["subdivision_encoded"] = subdiv_encoder.transform([data["SUBDIVISIONS"]])[0]
    else:
        return {"error": "Unknown subdivision"}, 400

    
    columns = ['subdivision_encoded', 'YEAR', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
               'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'ANNUAL']
    try:
        processed_data = {col: data[col] for col in columns}
        return pd.DataFrame([processed_data])
    except KeyError as e:
        return {"error": f"Missing field: {str(e)}"}, 400

def postprocess_output(prediction):
    """Convert numerical prediction to human-readable output."""
    return "YES" if prediction == 1 else "NO"

@app.route("/predict", methods=["POST"])
def predict():
    """API endpoint for flood prediction."""
    try:

        user_data = request.get_json()
        if not user_data:
            return jsonify({"error": "No input data provided"}), 400

        processed_data = preprocess_input(user_data)
        if isinstance(processed_data, tuple):  
            return jsonify(processed_data[0]), processed_data[1]


        prediction = ML_MODEL.predict(processed_data)[0]

       
        result = postprocess_output(prediction)

        ML_OUTPUT = {
            "SUBDIVISIONS": user_data["SUBDIVISIONS"],
            "YEAR": user_data["YEAR"],
            "PREDICTION": result
        }

        PROMPT = f'''
            You are an advanced AI tasked with generating human-readable insights based on a machine learning flood prediction model and additional contextual information. Use the provided input and output data, historical disaster information, and recent news to generate a detailed report.

            ### Input Data:
            Subdivision: {ML_OUTPUT["SUBDIVISIONS"]}  
            Year: {ML_OUTPUT["YEAR"]}  
            Monthly Rainfall (mm):  
            - January: {user_data["JAN"]}, February: {user_data["FEB"]}, March: {user_data["MAR"]}, April: {user_data["APR"]}, May: {user_data["MAY"]}, June: {user_data["JUN"]}, July: {user_data["JUL"]}, August: {user_data["AUG"]}, September: {user_data["SEP"]}, October: {user_data["OCT"]}, November: {user_data["NOV"]}, December: {user_data["DEC"]}  
            Annual Rainfall (mm): {user_data["ANNUAL"]}

            Model Output:
            Flood Prediction: {ML_OUTPUT["PREDICTION"]}  

            Historical Context:
            Provide an overview of past natural disasters, specifically floods, that occurred in the subdivision "{ML_OUTPUT["SUBDIVISIONS"]}". Include details about the severity, impact, and recovery efforts.

            Recent News:
            Summarize relevant recent news related to "{ML_OUTPUT["SUBDIVISIONS"]}". Focus on topics such as weather patterns, flood control measures, or any disaster management activities.

            Insights and Recommendations:
            1. Explanation: Provide a clear explanation of the flood prediction result based on the input data. 
            2. Historical Context: Discuss past disasters in this region and how they relate to the current prediction.
            3. Government Recommendations: Suggest actionable steps that local or national authorities could take if a flood were to occur in "{ML_OUTPUT["SUBDIVISIONS"]}".
            4. Recent Developments: Incorporate recent news highlights to provide additional context to your report.

            Output Format:
            Generate a structured, human-readable report with the following format:

            #### Flood Prediction Insights for SUBDIVISIONS ({ML_OUTPUT["YEAR"]})
            - **Prediction**: {ML_OUTPUT["PREDICTION"]}
            - **City/Subdivision**: Give brief about the city/subdivision "{ML_OUTPUT["SUBDIVISIONS"]}".
            - **Explanation**:  
              [Detailed explanation of the prediction based on input data.]

            - **Historical Disaster Context**:  
              [Overview of past disasters in the region.]

            - **Government Recommendations**:  
              - [Suggestion 1]  
              - [Suggestion 2]  

            - **Recent News Highlights**:  
              1. [News 1]  
              2. [News 2]

            Ensure that the report is concise, easy to understand, and actionable.
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
                        'ml_output': ML_OUTPUT
                        }), 200



        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)

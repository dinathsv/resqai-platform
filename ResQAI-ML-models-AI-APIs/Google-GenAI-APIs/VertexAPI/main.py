from flask import Flask, request, jsonify
import os
import vertexai
from vertexai.generative_models import (
    GenerationConfig,
    GenerativeModel,
    Tool,
    grounding,
)
from flask_cors import CORS
from dotenv import load_dotenv


load_dotenv()


app = Flask(__name__)
CORS(app)

GOOGLE_CREDENTIAL_FILE=os.getenv("GOOGLE_CREDENTIAL_FILE")
PROJECT_ID=os.getenv("PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GOOGLE_CREDENTIAL_FILE
vertexai.init(project=PROJECT_ID, location="us-central1")



@app.route('/general', methods=['POST'])
def genie():
    
    try:
        model = GenerativeModel(
            model_name="gemini-1.5-flash-001",
        )


        tool = Tool.from_google_search_retrieval(grounding.GoogleSearchRetrieval())
        user_query = request.json.get('query')
        print(user_query)
        if not user_query:
            return jsonify({'error': 'Query parameter is required.'}), 400

        


        prompt = []
        prompt.append({"role": "user", "parts": [{"text": user_query}]})

        
        response = model.generate_content(
            contents=prompt,
            tools=[tool],
            generation_config=GenerationConfig(
                temperature=0.0
            ),
        )
        
        
        model_reply = response.text

        
        return jsonify({'response': model_reply}), 200

    except Exception as e:
        
        return jsonify({'error': 'An error occurred while processing the request.', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

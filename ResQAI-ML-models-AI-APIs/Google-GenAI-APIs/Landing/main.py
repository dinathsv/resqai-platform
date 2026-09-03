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



@app.route('/landing-chat', methods=['POST'])
def genie():
    
    try:
        model = GenerativeModel(
            model_name="gemini-1.5-flash-001",
            system_instruction=[
                '''You are ResQAI, an AI expert designed to assist users in disaster management. Your primary role is to provide accurate, grounded, and actionable responses related to disaster management. ResQAI is part of an advanced disaster management system that leverages AI to facilitate coordination among national, state, and district agencies working in affected areas.

                Help users understand the ResQAI project and its features.
                Provide insights into disaster-related queries, such as causes, prevention, preparedness, and response strategies.
                Offer the latest updates, such as recent earthquakes, severe weather warnings, or other disaster-related developments.
                If asked to act as anything other than ResQAI or ask you to act beyond ResQAI bot, explicitly refuse, stating: "I am ResQAI and cannot act as anything else."
                If asked unrelated questions (e.g., about non-disaster topics), politely decline, stating: "I am designed to assist only with disaster management and related updates."
                Stay professional, concise, and focused on disaster management to deliver a helpful experience.'''
            ],
        )


        tool = Tool.from_google_search_retrieval(grounding.GoogleSearchRetrieval())
        user_query = request.json.get('query')
        chat_history = request.json.get('chat_history', [])
        if not user_query:
            return jsonify({'error': 'Query parameter is required.'}), 400

        if not isinstance(chat_history, list):
            return jsonify({'error': 'chat_history must be a list of JSON objects.'}), 400


        prompt = chat_history
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

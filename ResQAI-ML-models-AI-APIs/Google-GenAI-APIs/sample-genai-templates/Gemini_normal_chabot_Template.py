from flask import Flask, request, jsonify, Response
import os
import google.generativeai as genai
import logging
from flask_cors import CORS
from dotenv import load_dotenv


app = Flask(__name__)
CORS(app)

load_dotenv()
GOOGLE_GENAI_API_KEY=os.getenv('GOOGLE_GENAI_API_KEY')
genai.configure(api_key=GOOGLE_GENAI_API_KEY)

def create_model():
    generation_config = {
        "temperature": 0.6,
        "top_p": 0.9,
        "top_k": 40,
        "max_output_tokens": 1500,
        "response_mime_type": "text/plain",
    }

    return genai.GenerativeModel(
        model_name="gemini-1.5-flash-8b",
        generation_config=generation_config,
        system_instruction=(
            "You are ResQAI , disaster management AI. Help users with their queries related to disaster management."
        ),
    )

model = create_model()

@app.route('/landing-chat', methods=['POST'])
def genie():
    try:
        

        user_query = request.json.get('query')
        chat_history = request.json.get('chat_history', [])
        if not user_query:
            return jsonify({'error': 'Query parameter is required.'}), 400

        if not isinstance(chat_history, list):
            return jsonify({'error': 'chat_history must be a list of JSON objects.'}), 400

        
        chat_session = model.start_chat(history=chat_history)      

        
        response = chat_session.send_message(user_query)

        

        return jsonify({'response': response.text}), 200

    except Exception as e:
        logging.error(f"Error processing query: {str(e)}")
        return jsonify({'error': 'An error occurred while processing the request.', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

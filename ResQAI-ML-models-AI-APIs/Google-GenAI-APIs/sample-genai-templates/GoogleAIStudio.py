import os
import google.generativeai as genai

genai.configure(api_key='API_KEY')

# Create the model
generation_config = {
  "temperature": 1,
  "top_p": 0.95,
  "top_k": 40,
  "max_output_tokens": 8192,
  "response_mime_type": "text/plain",
}

model = genai.GenerativeModel(
  model_name="gemini-1.5-flash-8b",
  generation_config=generation_config,
  system_instruction="SYSTEM_PROMPT",
)

chat_session = model.start_chat(
  history=[
    {
      "role": "user",
      "parts": [
        "hi",
      ],
    },
    {
      "role": "model",
      "parts": [
        "Hi there!  How can I help you today?  Looking for a new job, seeking career advice, or something else?\n",
      ],
    },
  ]
)

response = chat_session.send_message("hi")

print(response.text)
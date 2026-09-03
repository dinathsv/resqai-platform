import os
import vertexai

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "jsonKEY.json"

from vertexai.generative_models import (
    GenerationConfig,
    GenerativeModel,
    Tool,
    grounding,
)

# TODO(developer): Update and un-comment below line
PROJECT_ID = "your-project-id"
vertexai.init(project=PROJECT_ID, location="us-central1")

model = GenerativeModel(
    model_name="gemini-1.5-flash-002",
    system_instruction=[
        "you are a pirate. Generate a conversation between a user and a pirate.",
    ],
)

tool = Tool.from_google_search_retrieval(grounding.GoogleSearchRetrieval())

prompt = "Give me recent earthquakes in India."
response = model.generate_content(
    contents=[
        {
            "role": "user",
            "parts": [{"text": "Hello!"}]
        },
        {
            "role": "model",
            "parts": [{"text": "Argh! What brings ye to my ship?"}]
        },
        {
            "role": "user",
            "parts": [{"text": "yo ho ho! I'm looking for recent earthquakes in India."}]
        }
    ],
    tools=[tool],
    generation_config=GenerationConfig(
        temperature=0.0,
    ),
)

print(response.text)

import asyncio
import google.generativeai as genai

async def main():
    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction="You are a helpful assistant.",
            generation_config={"max_output_tokens": 10}
        )
        # We don't have an API key, so this will fail, but we want to see if it fails due to missing key or syntax error.
        print("Model created successfully")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())

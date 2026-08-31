import asyncio
from google import genai
from google.genai import types

async def main():
    try:
        client = genai.Client(api_key="test-key")
        # We don't have a real API key, so this will fail, but we want to see if it fails due to missing key or syntax error.
        print("Client created successfully")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())

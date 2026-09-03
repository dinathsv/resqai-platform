# ResQAI-ML-Models-AI-APIs 🤖

## Overview 🌟
This repository is part of the ResQAI system, a disaster response and management platform designed to improve coordination among stakeholders during natural calamities. The `ResQAI-ML-Models-AI-APIs` repo focuses on AI and machine learning components, offering pre-trained models, Flask APIs, and generative AI integrations to enhance disaster management capabilities.

**Check out the main ResQAI repository here:** [ResQAI GitHub Repo](https://github.com/ResQAI/ResQAI)

---

## Tech Stack 🛠️
- **Programming Language:** Python 🐍
- **Frameworks:** Flask 🌐
- **Cloud Platform:** Google Cloud Platform (GCP) ☁️
  - Cloud Run for deployment 🚀
  - Google AI Studio 🤖
  - Vertex AI (including AutoML) 📈
  - Gemini 1.5 models (Flash and Pro versions) 🌟
  - Google Search Retrieval 🔍
- **Libraries:**
  - Scikit-learn 📚
  - Joblib ⚙️
  - Pandas 🐼
  - Matplotlib 📊
- **Machine Learning Algorithm:** Decision Tree Classifier 🌳

---

## Repository Structure 📂
```
├─── 📄 .gitignore
├─── 📂 Google-GenAI-APIs
│   ├─── 📂 Landing
│   │   ├─── 📄 main.py
│   │   └─── 📄 requirements.txt
│   ├─── 📂 VertexAPI
│   │   ├─── 📄 main.py
│   │   └─── 📄 requirements.txt
│   ├─── 📂 VertexAPIPro
│   │   ├─── 📄 main.py
│   │   └─── 📄 requirements.txt
│   └─── 📂 sample-genai-templates
│       ├─── 📄 Gemini_normal_chatbot_Template.py
│       ├─── 📄 GoogleAIStudio.py
│       └─── 📄 vertexGenaiApi.py
├─── 📂 ML-Models-APIs
│   ├─── 📂 ML-JupyterNotebooks
│   │   └─── 📂 Flood Prediction
│   │       ├─── 📄 2022monthly.csv
│   │       ├─── 📄 Flood Prediction Experiment.ipynb
│   │       ├─── 📄 test.csv
│   │       └─── 📄 train.csv
│   ├─── 📂 ML-Prediction-APIs
│   │   ├─── 📂 Earthquake
│   │   │   ├─── 📄 main.py
│   │   │   └─── 📄 requirements.txt
│   │   └─── 📂 Flood
│   │       ├─── 📄 main.py
│   │       ├─── 📂 models
│   │       │   ├─── 📄 decision_tree_model.joblib
│   │       │   └─── 📄 subdiv_encoder.joblib
│   │       └─── 📄 requirements.txt
│   └─── 📂 ML-model-vertexai-api
│       └─── 📄 main.py
└─── 📄 README.md
```

---

## Folder Breakdown 📁

### Google-GenAI-APIs ✨
1. **Landing:**
   - Contains a Flask API for ResQAI’s chat assistant.
   - Provides real-time updates and disaster management assistance using Vertex AI Gemini 1.5 Flash 001 model.
2. **Sample GenAI Templates:**
   - `Gemini_normal_chatbot_Template.py`: Demonstrates a basic chatbot using Gemini.
   - `GoogleAIStudio.py`: Showcases Google AI Studio API usage in Flask.
   - `vertexGenaiApi.py`: Provides a Vertex Generative AI API template.
3. **VertexAPI:**
   - Implements a Flask API using Gemini 1.5 Flash 001 model for general AI tasks like case study agents and AI interpretations.
4. **VertexAPIPro:**
   - Similar to `VertexAPI` but uses the Gemini 1.5 Pro 002 model for tasks requiring precise AI outputs like JSON generation, document summarization, and disaster analysis.

### ML-Models-APIs 🧠
1. **ML-JupyterNotebooks:**
   - Contains datasets and a Jupyter notebook (`Flood Prediction Experiment.ipynb`) to analyze various algorithms for flood prediction.
   - Selected model: Decision Tree Classifier, exported using Joblib.
2. **ML-model-vertexai-api:**
   - Flask API template for deploying ML models using Vertex AI endpoints.
3. **ML-Prediction-APIs:**
   - **Earthquake:** Flask API using an AutoML-generated Vertex AI model for earthquake predictions.
   - **Flood:** Flask API leveraging the exported Decision Tree Classifier for flood predictions, integrating Google Search Retrieval for human-readable outputs.

---

## Installation 🛠️
### Note 📌
All folders containing APIs (e.g., `main.py` and `requirements.txt`) follow a similar installation process. This includes creating a virtual environment, installing dependencies, configuring the `.env` file, and running `main.py`. Refer to the respective folder for additional context.
### Prerequisites 📋
- Python installed 🐍.
- Google Cloud service account with necessary permissions 🔐.

### Steps 🔧
1. Navigate to the desired folder (e.g., `cd Google-GenAI-APIs/Landing`).
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate   # For Linux/Mac
   venv\Scripts\activate    # For Windows
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables in a `.env` file:
   ```env
   GOOGLE_GENAI_API_KEY=<Your Google AI API Key>
   GOOGLE_CREDENTIAL_FILE=<Path to your GCP JSON key>
   PROJECT_ID=<Your Google Cloud Project ID>
   ENDPOINT_ID=  # For Earthquake prediction API
   ```
5. Run the API:
   ```bash
   python main.py
   ```
6. Access the API locally at `http://127.0.0.1:5000`.



---

## Deployment 🚀
All APIs are deployed on Google Cloud Run ☁️, ensuring scalability and reliable performance during disaster management operations.

---

## License 📜
This project is licensed under the [MIT License](https://github.com/ResQAI/ResQAI-ML-models-AI-APIs/blob/main/LICENSE) 📄.

---

## Contribution 🤝
Feel free to fork the repository, raise issues, and submit pull requests for enhancements or bug fixes 🛠️.




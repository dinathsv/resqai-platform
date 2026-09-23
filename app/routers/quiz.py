"""
ResQAI — Quiz Router
Disaster Preparedness Quiz questions and attempt tracking.
"""

import uuid
import random
from typing import Any, List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter(tags=["Quiz"])

# ---------- Schemas ----------

class OptionOut(BaseModel):
    id: str
    text: str
    is_correct: bool

class QuestionOut(BaseModel):
    question_id: str
    question_text: str
    category: str
    explanation: str
    options: List[OptionOut]

class AttemptAnswer(BaseModel):
    question_id: str
    option_id: str

class AttemptIn(BaseModel):
    answers: List[AttemptAnswer]

class AttemptOut(BaseModel):
    score: int
    total: int
    percentage: float

# ---------- Question Bank ----------

QUESTION_BANK: list[dict[str, Any]] = [
    {
        "question_id": "q1",
        "question_text": "What should you do first when an earthquake starts?",
        "category": "Earthquake",
        "explanation": "Drop, Cover, and Hold On is the recommended action during an earthquake to protect yourself from falling debris.",
        "options": [
            {"id": "q1a", "text": "Run outside immediately", "is_correct": False},
            {"id": "q1b", "text": "Drop, Cover, and Hold On", "is_correct": True},
            {"id": "q1c", "text": "Stand in a doorway", "is_correct": False},
            {"id": "q1d", "text": "Call emergency services", "is_correct": False},
        ],
    },
    {
        "question_id": "q2",
        "question_text": "During a flood warning, which action is most important?",
        "category": "Flood",
        "explanation": "Moving to higher ground is the safest action during a flood warning to avoid being trapped by rising water.",
        "options": [
            {"id": "q2a", "text": "Drive through floodwater to escape", "is_correct": False},
            {"id": "q2b", "text": "Move to higher ground immediately", "is_correct": True},
            {"id": "q2c", "text": "Stay in the basement", "is_correct": False},
            {"id": "q2d", "text": "Wait for official rescue", "is_correct": False},
        ],
    },
    {
        "question_id": "q3",
        "question_text": "What is the recommended emergency water supply per person per day?",
        "category": "Preparedness",
        "explanation": "Emergency preparedness guidelines recommend storing at least 1 gallon (about 3.8 liters) of water per person per day for at least 3 days.",
        "options": [
            {"id": "q3a", "text": "1 cup", "is_correct": False},
            {"id": "q3b", "text": "1 liter", "is_correct": False},
            {"id": "q3c", "text": "1 gallon (3.8 liters)", "is_correct": True},
            {"id": "q3d", "text": "5 gallons", "is_correct": False},
        ],
    },
    {
        "question_id": "q4",
        "question_text": "What should you NOT do during a tsunami warning?",
        "category": "Tsunami",
        "explanation": "Going to the beach to watch is extremely dangerous. You should move inland to higher ground immediately.",
        "options": [
            {"id": "q4a", "text": "Move inland to higher ground", "is_correct": False},
            {"id": "q4b", "text": "Go to the beach to watch the waves", "is_correct": True},
            {"id": "q4c", "text": "Listen to emergency broadcasts", "is_correct": False},
            {"id": "q4d", "text": "Alert your neighbors", "is_correct": False},
        ],
    },
    {
        "question_id": "q5",
        "question_text": "Which item is most essential in an emergency first-aid kit?",
        "category": "First Aid",
        "explanation": "Sterile bandages and gauze are essential for wound care and stopping bleeding, which is one of the most common emergency injuries.",
        "options": [
            {"id": "q5a", "text": "Sunscreen", "is_correct": False},
            {"id": "q5b", "text": "Sterile bandages and gauze", "is_correct": True},
            {"id": "q5c", "text": "Vitamin supplements", "is_correct": False},
            {"id": "q5d", "text": "Hand lotion", "is_correct": False},
        ],
    },
    {
        "question_id": "q6",
        "question_text": "If you smell gas after an earthquake, what should you do?",
        "category": "Earthquake",
        "explanation": "If you smell gas, evacuate immediately and do not use any electrical switches or open flames, as they could ignite the gas.",
        "options": [
            {"id": "q6a", "text": "Light a match to find the leak", "is_correct": False},
            {"id": "q6b", "text": "Turn on the lights to check", "is_correct": False},
            {"id": "q6c", "text": "Evacuate and call the gas company from outside", "is_correct": True},
            {"id": "q6d", "text": "Open all windows and stay inside", "is_correct": False},
        ],
    },
    {
        "question_id": "q7",
        "question_text": "What is the emergency number in Sri Lanka?",
        "category": "Emergency Services",
        "explanation": "In Sri Lanka, 119 is the national emergency hotline that connects to police, ambulance, and fire services.",
        "options": [
            {"id": "q7a", "text": "911", "is_correct": False},
            {"id": "q7b", "text": "999", "is_correct": False},
            {"id": "q7c", "text": "119", "is_correct": True},
            {"id": "q7d", "text": "112", "is_correct": False},
        ],
    },
    {
        "question_id": "q8",
        "question_text": "During a landslide, which direction should you move?",
        "category": "Landslide",
        "explanation": "Move perpendicular (sideways) to the direction of the landslide flow to get out of its path as quickly as possible.",
        "options": [
            {"id": "q8a", "text": "Downhill, away from the slide", "is_correct": False},
            {"id": "q8b", "text": "Directly uphill into the slide", "is_correct": False},
            {"id": "q8c", "text": "Perpendicular to the slide direction", "is_correct": True},
            {"id": "q8d", "text": "Stay in place and wait", "is_correct": False},
        ],
    },
    {
        "question_id": "q9",
        "question_text": "How often should you replace stored emergency water supplies?",
        "category": "Preparedness",
        "explanation": "Emergency water should be replaced every 6 months to ensure it remains safe for consumption.",
        "options": [
            {"id": "q9a", "text": "Every month", "is_correct": False},
            {"id": "q9b", "text": "Every 6 months", "is_correct": True},
            {"id": "q9c", "text": "Every 2 years", "is_correct": False},
            {"id": "q9d", "text": "Never, water doesn't expire", "is_correct": False},
        ],
    },
    {
        "question_id": "q10",
        "question_text": "What is the correct technique for performing CPR on an adult?",
        "category": "First Aid",
        "explanation": "For adult CPR, compress the chest at least 2 inches deep at a rate of 100-120 compressions per minute in the center of the chest.",
        "options": [
            {"id": "q10a", "text": "Press lightly on the stomach", "is_correct": False},
            {"id": "q10b", "text": "Push hard and fast on center of chest, 2 inches deep", "is_correct": True},
            {"id": "q10c", "text": "Blow air into the ear", "is_correct": False},
            {"id": "q10d", "text": "Slap the person's face to wake them", "is_correct": False},
        ],
    },
    {
        "question_id": "q11",
        "question_text": "What is the safest place in your home during a cyclone?",
        "category": "Cyclone",
        "explanation": "An interior room on the lowest floor away from windows provides the best protection during a cyclone.",
        "options": [
            {"id": "q11a", "text": "Near a large window to watch", "is_correct": False},
            {"id": "q11b", "text": "On the roof", "is_correct": False},
            {"id": "q11c", "text": "Interior room on the lowest floor", "is_correct": True},
            {"id": "q11d", "text": "In the garage", "is_correct": False},
        ],
    },
    {
        "question_id": "q12",
        "question_text": "Which of these should be in your emergency 'Go Bag'?",
        "category": "Preparedness",
        "explanation": "An emergency Go Bag should include copies of important documents (ID, insurance, medical records) along with water, food, and first-aid supplies.",
        "options": [
            {"id": "q12a", "text": "Board games for entertainment", "is_correct": False},
            {"id": "q12b", "text": "Copies of important documents and IDs", "is_correct": True},
            {"id": "q12c", "text": "Decorative items", "is_correct": False},
            {"id": "q12d", "text": "Heavy furniture", "is_correct": False},
        ],
    },
    {
        "question_id": "q13",
        "question_text": "What should you do if someone is having a seizure?",
        "category": "First Aid",
        "explanation": "During a seizure, protect the person from injury by clearing the area, cushion their head, and never put anything in their mouth.",
        "options": [
            {"id": "q13a", "text": "Hold the person down firmly", "is_correct": False},
            {"id": "q13b", "text": "Put something in their mouth", "is_correct": False},
            {"id": "q13c", "text": "Clear the area and cushion their head", "is_correct": True},
            {"id": "q13d", "text": "Pour water on their face", "is_correct": False},
        ],
    },
    {
        "question_id": "q14",
        "question_text": "What does a red flag warning indicate in disaster management?",
        "category": "Emergency Services",
        "explanation": "A red flag warning indicates extreme fire weather conditions with high risk of wildfire due to low humidity, strong winds, and dry conditions.",
        "options": [
            {"id": "q14a", "text": "Flood risk", "is_correct": False},
            {"id": "q14b", "text": "Extreme fire weather conditions", "is_correct": True},
            {"id": "q14c", "text": "Tsunami approaching", "is_correct": False},
            {"id": "q14d", "text": "Air quality is good", "is_correct": False},
        ],
    },
    {
        "question_id": "q15",
        "question_text": "After a disaster, what is the safest water to drink?",
        "category": "Preparedness",
        "explanation": "After a disaster, tap water may be contaminated. Sealed bottled water or water that has been boiled for at least one minute is safest.",
        "options": [
            {"id": "q15a", "text": "River or stream water", "is_correct": False},
            {"id": "q15b", "text": "Tap water without treatment", "is_correct": False},
            {"id": "q15c", "text": "Sealed bottled water or boiled water", "is_correct": True},
            {"id": "q15d", "text": "Rainwater collected in open containers", "is_correct": False},
        ],
    },
]


# ---------- Endpoints ----------

@router.get("/questions", response_model=List[QuestionOut])
async def get_quiz_questions(count: int = 10):
    """Return a randomized set of quiz questions."""
    pool = list(QUESTION_BANK)
    random.shuffle(pool)
    selected = pool[: min(count, len(pool))]
    return selected


@router.post("/attempts", response_model=AttemptOut)
async def submit_quiz_attempt(attempt: AttemptIn):
    """Score a quiz attempt and return results."""
    questions_map = {q["question_id"]: q for q in QUESTION_BANK}
    score = 0
    total = len(attempt.answers)

    for answer in attempt.answers:
        question = questions_map.get(answer.question_id)
        if question:
            for option in question["options"]:
                if option["id"] == answer.option_id and option["is_correct"]:
                    score += 1
                    break

    percentage = (score / total * 100) if total > 0 else 0
    return AttemptOut(score=score, total=total, percentage=round(percentage, 1))

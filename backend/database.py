import os

from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
DB_CA_PATH = os.environ.get("DB_CA_PATH", "backend/ca.pem")

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "ssl": {
            "ca": DB_CA_PATH
        }
    }
)

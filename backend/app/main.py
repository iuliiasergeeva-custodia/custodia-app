from app.database import Base, engine
from app import models

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("All tables created successfully.")


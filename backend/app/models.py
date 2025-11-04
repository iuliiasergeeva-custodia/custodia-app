from sqlalchemy import Column, Integer, String, Float, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="client", cascade="all, delete")
    trackers = relationship("Tracker", back_populates="client", cascade="all, delete")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"))
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="viewer")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    client = relationship("Client", back_populates="users")


class Tracker(Base):
    __tablename__ = "trackers"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"))
    tracker_id = Column(String(50), unique=True, nullable=False)
    slug = Column(String(50), unique=True)
    animal_type = Column(String(50))
    animal_name = Column(String(50))
    family = Column(String(50))
    expected_battery_life = Column(Integer)
    acquisition_frequency = Column(Integer)
    send_frequency = Column(Integer)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    client = relationship("Client", back_populates="trackers")
    locations = relationship("Location", back_populates="tracker", cascade="all, delete")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    tracker_id = Column(Integer, ForeignKey("trackers.id", ondelete="CASCADE"))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    date_time = Column(TIMESTAMP(timezone=True), nullable=False)
    battery_voltage = Column(Float)
    fix_number = Column(Integer)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    tracker = relationship("Tracker", back_populates="locations")


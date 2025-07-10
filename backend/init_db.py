try:
    from database import engine, Base
except ImportError:  # when run as module
    from .database import engine, Base


def init_db():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
from fastapi import FastAPI
from routers import cursor

app = FastAPI()

app.include_router(cursor.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}

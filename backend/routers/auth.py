from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from auth import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    check_password,
    create_session_token,
    verify_session_token,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
def login(req: LoginRequest, request: Request, response: Response):
    if not check_password(req.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    token = create_session_token()
    # Secure cookies require HTTPS; relax that requirement on localhost so
    # local dev keeps working without any special config.
    is_local = request.url.hostname in ("localhost", "127.0.0.1")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=not is_local,
        samesite="lax",
        path="/",
    )
    return {"ok": True}


@router.get("/session")
def session_status(request: Request):
    token = request.cookies.get(SESSION_COOKIE_NAME)
    return {"authenticated": verify_session_token(token)}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"ok": True}

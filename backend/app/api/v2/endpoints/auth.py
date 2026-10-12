from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from app.api import deps
from app.core import security
from app.db.models import User
from app.schemas.auth import UserCreate, UserResponse, Token

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(deps.get_db)
):
    if len(user_in.password.encode('utf-8')) > 72:
        raise HTTPException(status_code=400, detail="Password is too long (max 72 bytes).")
        
    stmt = select(User).where(User.email == user_in.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists."
        )
        
    hashed_password = security.get_password_hash(user_in.password)
    user = User(email=user_in.email, hashed_password=hashed_password)
    db.add(user)
    
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists."
        )
        
    return user

@router.post("/login")
async def login(
    response: Response,
    user_in: UserCreate,
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(User).where(User.email == user_in.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not security.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token = security.create_access_token(user.id)
    
    # Set secure HttpOnly cookie
    is_secure = (security.settings.ENVIRONMENT == "production")
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="none" if is_secure else "lax",
        secure=is_secure
    )
    
    return {"message": "Successfully logged in"}

@router.post("/logout")
async def logout(response: Response):
    is_secure = (security.settings.ENVIRONMENT == "production")
    response.delete_cookie(
        "access_token",
        httponly=True,
        samesite="none" if is_secure else "lax",
        secure=is_secure
    )
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: deps.CurrentUser):
    return current_user

@router.delete("/user")
async def delete_user_by_email(email: str, db: AsyncSession = Depends(deps.get_db)):
    from sqlalchemy import delete
    result = await db.execute(delete(User).where(User.email == email))
    await db.commit()
    return {"message": f"User {email} deleted", "count": result.rowcount}


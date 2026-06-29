@echo off
echo Stopping existing Next.js process...
taskkill /F /IM node.exe 2>nul

echo Cleaning up .next directory...
rmdir /s /q .next 2>nul

echo Starting fresh development server...
npm run dev

pause
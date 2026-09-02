# ResQAI Sequence Flow Audit Report

## Audit Date
2026-09-02

## Flow Analysis

### Flow 1: User Login (Returning User) ✅ MOSTLY CORRECT
**Location**: 
- Mobile: `/resqai-mobile/app/(auth)/login.tsx`
- Backend: `/app/routers/auth.py` - `POST /login`

**Current Implementation**:
1. ✅ User enters email and password
2. ✅ Backend checks credentials against database
3. ✅ Backend verifies account (checks password hash, is_verified)
4. ✅ [Valid] -> Login success -> returns JWT token
5. ✅ [Invalid] -> Returns 401 with "Invalid credentials"

**Issues Found**: NONE - Correctly implemented

---

### Flow 2: Registration (New Account) ⚠️ PARTIALLY BROKEN
**Location**:
- Mobile: `/resqai-mobile/app/(auth)/register.tsx` → `/resqai-mobile/app/(auth)/otp.tsx`
- Backend: `/app/routers/auth.py` - `POST /register`, `POST /verify-otp`

**Current Implementation**:
1. ✅ User enters details (name, email, phone, password, NIC missing)
2. ✅ Backend creates user account
3. ✅ Backend sends OTP (mock SMS to console)
4. ✅ User receives OTP
5. ✅ User enters OTP
6. ✅ Backend verifies OTP
7. ✅ [Valid OTP] -> Account verified -> Returns JWT -> Dashboard
8. ✅ [Invalid OTP] -> Shows error message

**Issues Found**:
- ❌ **MISSING: NIC field in registration form** (sequence diagram says "name, password, phone, NIC")
- ❌ **MISSING: OTP retry mechanism** - user cannot request new OTP if expired/wrong
- ⚠️ **MISSING: Retry limit** - no limit on OTP verification attempts

---

### Flow 3: Asking for Help (Registered Users) ❌ CRITICAL ISSUES
**Location**:
- Mobile: `/mobile/app/(people)/help.tsx` (STUB), `/mobile/app/(people)/chatbot.tsx`, `/mobile/app/(people)/locator.tsx`
- Backend: `/app/routers/requests.py` - `POST /requests`

**Current Implementation**:
1. ❌ Help center is a STUB - shows "under construction"
2. ❌ Missing options menu (AI chatbot, call 1990, submit request)
3. ✅ AI chatbot exists separately but not integrated into help flow
4. ❌ **CRITICAL: Call 1990 flow is missing** - no emergency call with backend notification
5. ✅ Request submission calls AI Brain for analysis BEFORE saving (correct order)
6. ✅ Request is saved to database after AI analysis
7. ❌ **CRITICAL: Missing "critical emergency -> alert admin" logic**
8. ✅ Request confirmation returned to user

**Issues Found**:
- ❌ **Help screen is completely unimplemented** - needs full rebuild
- ❌ **Missing: Emergency call flow** - tap 1990 → make call + send location to backend
- ❌ **CRITICAL: Missing admin alert on critical emergencies** (urgency >= 4)
- ❌ **AI analysis happens but critical alert never triggers**

---

### Flow 4: Guest User Asking for Help ⚠️ PARTIALLY BROKEN
**Location**:
- Mobile: `/resqai-mobile/app/(guest)/nic-verify.tsx` → `/resqai-mobile/app/(guest)/request.tsx`
- Backend: `/app/routers/auth.py` - `POST /guest/verify-nic`

**Current Implementation**:
1. ✅ Guest opens app, requests guest access
2. ✅ Guest enters NIC
3. ✅ Backend validates NIC format (regex)
4. ✅ Backend checks NIC registry
5. ✅ [Valid] -> NIC verified -> returns guest token
6. ✅ [Invalid] -> Error message shown
7. ❌ **Guest request form is a STUB** - placeholder only
8. ❌ Cannot proceed with help request after NIC verification

**Issues Found**:
- ❌ **Guest request screen is unimplemented** - needs full implementation
- ✅ NIC validation works correctly (format + registry check)
- ✅ is_guest_request flag is properly set in backend
- ❌ **Missing: Guest help flow** (AI, call 1990 options)

---

### Flow 5: Donating Relief Goods ❌ BROKEN
**Location**:
- Mobile: `/mobile/app/(people)/donate.tsx`
- Backend: MISSING - `POST /api/donations` endpoint does not exist

**Current Implementation**:
1. ✅ Donor selects mission and enters amount
2. ✅ Donor enters payment details
3. ❌ **Backend endpoint missing** - app calls `/api/donations` but route doesn't exist
4. ❌ Backend should save donation record - NOT IMPLEMENTED
5. ❌ Backend should notify admin - NOT IMPLEMENTED  
6. ❌ Backend should return drop-off details - NOT IMPLEMENTED

**Issues Found**:
- ❌ **CRITICAL: Entire donations router is missing from backend**
- ❌ `/api/missions` endpoint also missing (needed to fetch missions)
- ✅ Database model exists (Donation model)
- ❌ No admin notification on new donation
- ❌ No drop-off location logic

---

### Flow 6: Admin Sending Area Alert ❌ COMPLETELY MISSING
**Location**:
- Backend: SHOULD BE in `/app/routers/` but doesn't exist
- Database: Model exists at `/app/models/emergency_alert.py`

**Current Implementation**:
1. ❌ **No admin endpoint to create alerts**
2. ❌ No logic to find users in affected area
3. ❌ No notification sending
4. ❌ No delivery report tracking
5. ❌ EmergencyAlert model has `delivered_count` field but never used

**Issues Found**:
- ❌ **CRITICAL: Entire alert creation flow is missing**
- ❌ **CRITICAL: No notification system integration**
- ❌ **CRITICAL: No geospatial query to find affected users**
- ✅ Database model exists with all required fields
- ❌ No SMS/push notification service integration

---

## Summary of Critical Issues

### Must Fix (Blocking Core Flows)
1. ❌ **Flow 3: Help center completely unimplemented** - core feature missing
2. ❌ **Flow 3: Call 1990 emergency flow missing** - critical safety feature
3. ❌ **Flow 3: No admin alert on critical emergencies** - defeats purpose of urgency detection
4. ❌ **Flow 4: Guest request form is stub** - guest users cannot submit requests
5. ❌ **Flow 5: Donations backend completely missing** - feature non-functional
6. ❌ **Flow 6: Alert system completely missing** - major feature gap

### Should Fix (Incomplete Flows)
7. ⚠️ **Flow 2: Missing NIC in registration** - diagram specifies it
8. ⚠️ **Flow 2: No OTP retry mechanism** - poor UX
9. ⚠️ **Flow 6: No notification delivery reports** - admin has no feedback

### Working Correctly
- ✅ Flow 1: User login - fully functional
- ✅ Flow 2: Registration and OTP (except retry)
- ✅ Flow 4: NIC verification logic
- ✅ Flow 3: AI Brain analysis happens before saving (correct order)
- ✅ Guest vs registered user distinction in database

---

## Files Requiring Changes

### Critical Priority
1. `/mobile/app/(people)/help.tsx` - Replace stub with full implementation
2. `/resqai-mobile/app/(guest)/request.tsx` - Replace stub with full form
3. `/app/routers/requests.py` - Add critical alert notification
4. `/app/routers/` - Create `donations.py` router
5. `/app/routers/` - Create `alerts.py` router with area notification
6. `/app/routers/` - Create `missions.py` router

### Medium Priority  
7. `/resqai-mobile/app/(auth)/register.tsx` - Add NIC field
8. `/resqai-mobile/app/(auth)/otp.tsx` - Add retry mechanism
9. `/app/routers/auth.py` - Add OTP resend endpoint

### Low Priority
10. Notification service integration for alerts

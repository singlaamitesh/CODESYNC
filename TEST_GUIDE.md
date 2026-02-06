# 🧪 Test Guide: Text Duplication Fix

## ✅ Services Running:
- Frontend: http://localhost:8080
- Backend: http://localhost:8000
- Y.js: ws://localhost:8001

---

## 🎯 Test 1: No Duplication on Multi-Tab

**Steps:**
1. Open http://localhost:8080 in **Tab 1**
2. Select any document (e.g., h.py)
3. Type: "hello world"
4. Open http://localhost:8080 in **Tab 2** (same browser)
5. Open the same document (h.py)

**Expected Result:**
- ✅ Tab 2 shows: "hello world" (NOT "hello worldhello world")
- ✅ User count shows: 1 user (same user identity)

**Before Fix (BROKEN):**
- ❌ Tab 2 would show: "hello worldhello world"

---

## 🎯 Test 2: No Duplication on Browser Switch

**Steps:**
1. Open http://localhost:8080 in **Chrome**
2. Select a document
3. Type: "test123"
4. Open http://localhost:8080 in **Safari** (or Firefox)
5. Open the same document

**Expected Result:**
- ✅ Safari shows: "test123" (NOT "test123test123")
- ✅ User count shows: 2 users (different browsers)
- ✅ Both users can see each other's cursors

**Before Fix (BROKEN):**
- ❌ Safari would show: "test123test123"

---

## 🎯 Test 3: No Duplication on Refresh

**Steps:**
1. Open http://localhost:8080
2. Select a document
3. Type: "abc"
4. Press **Cmd+R** (Mac) or **Ctrl+R** (Windows) to refresh
5. Open the same document again

**Expected Result:**
- ✅ Shows: "abc" (NOT "abcabc")
- ✅ Content persists correctly

**Before Fix (BROKEN):**
- ❌ Would show: "abcabc" or "abcabcabc"

---

## 🎯 Test 4: Real-Time Multi-User Sync

**Steps:**
1. Open http://localhost:8080 in **Chrome**
2. Open http://localhost:8080 in **Safari**
3. Both open the SAME document
4. Chrome types: "line 1"
5. Safari types: "line 2"
6. Chrome types: "line 3"

**Expected Result:**
- ✅ Both browsers show:
  ```
  line 1
  line 2
  line 3
  ```
- ✅ No duplication
- ✅ See each other's cursors moving
- ✅ User count shows: 2 users

---

## 🎯 Test 5: File Switching (Previous Bug)

**Steps:**
1. Open http://localhost:8080
2. Open document "h.py"
3. Type: "python code"
4. Switch to document "ji.py"
5. Switch back to "h.py"

**Expected Result:**
- ✅ h.py shows: "python code" (content appears immediately)
- ✅ No blank screen
- ✅ No duplication

**Before Fix (BROKEN):**
- ❌ Blank screen until refresh

---

## 🔍 How to Debug (Browser Console):

Press **F12** → Console tab

**Good Logs (Working):**
```
[CRDT] Monaco editor mounted
[CRDT] Connection status: connected (User: YourName)
[CRDT] Sync status: synced
[CRDT] Y.Text already has 11 chars (synced from other users)  ← GOOD!
```

**Bad Logs (Duplication - should NOT see this):**
```
[CRDT] Pre-populated Y.Text with 11 chars  ← This should ONLY appear for first user
```

---

## 📊 Expected Behavior Summary:

| Action | Before Fix | After Fix |
|--------|------------|-----------|
| Open in 2 tabs | Text doubled ❌ | Same text ✅ |
| Open in 2 browsers | Text doubled ❌ | Synced correctly ✅ |
| Refresh page | Text tripled ❌ | Same text ✅ |
| Switch files | Blank screen ❌ | Shows immediately ✅ |
| User count (same browser) | 2+ users ❌ | 1 user ✅ |

---

## ✅ All Fixed Issues:

1. ✅ Text duplication on multi-tab
2. ✅ Text duplication on multi-browser
3. ✅ Text duplication on refresh
4. ✅ Blank screen when switching files
5. ✅ User count shows same user across tabs
6. ✅ User identity persists (same color/name)

---

## 🚀 Ready to Test!

Open: http://localhost:8080

Try all 5 tests above and verify everything works correctly!

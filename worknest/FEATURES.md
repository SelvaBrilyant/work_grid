# WorkNest Feature Roadmap

This document tracks all planned features for WorkNest, organized by implementation priority (easiest to hardest).

## 📊 Implementation Progress

| Phase | Feature | Status | Complexity |
|-------|---------|--------|------------|
| 1 | Custom Status & Presence | ✅ Done | 🟢 Easy |
| 2 | Rich User Profiles | ✅ Done | 🟢 Easy |
| 3 | Global Files Gallery | ✅ Done | 🟢 Easy |
| 4 | Advanced Mentions (@channel, @here) | ✅ Done | 🟡 Medium |
| 5 | Threaded Conversations | ✅ Done | 🟡 Medium |
| 6 | Global Search | ✅ Done | 🟡 Medium |
| 7 | Granular Notifications | ✅ Done | 🟡 Medium |
| 8 | Voice Messages | ✅ Done | 🟡 Medium |
| 9 | Kanban Task Boards | ⬜ Pending | 🔴 Hard |
| 10 | Shared Knowledge Base (Wiki) | ⬜ Pending | 🔴 Hard |
| 11 | Huddles (Voice & Video) | ⬜ Pending | 🔴 Hard |
| 12 | Live Collaborative Canvas | ⬜ Pending | 🔴 Hard |

---

## 🟢 Phase 1: Easy Features

### 1. Custom Status & Presence
**Status**: ✅ Complete

Allow users to set a custom status message with optional emoji.

**Backend Requirements:**
- [x] Add `customStatus` field to User model (text + emoji + expiry)
- [x] Create API endpoint: `PUT /api/users/status`
- [x] Broadcast status changes via WebSocket

**Frontend Requirements:**
- [x] Status picker UI with preset options
- [x] Custom status input with emoji selector
- [x] Display status next to user avatar
- [x] Status expiry dropdown (30 min, 1 hour, 4 hours, Today, Custom)

---

### 2. Rich User Profiles
**Status**: ✅ Complete

Enhanced user profiles with more professional details.

**Backend Requirements:**
- [x] Add profile fields: `title`, `department`, `phone`, `timezone`, `bio`
- [x] Create API endpoint: `PUT /api/users/profile`

**Frontend Requirements:**
- [x] Enhanced profile editing form in Settings
- [x] Rich profile view in DetailsPanel for users
- [x] Timezone display with local time

---

### 3. Global Files Gallery
**Status**: ✅ Complete

Browse all files shared in a channel in a dedicated gallery view.

**Backend Requirements:**
- [x] Create API endpoint: `GET /api/channels/:id/files`
- [x] Return all messages with attachments, grouped by type

**Frontend Requirements:**
- [x] "Files" tab in DetailsPanel
- [x] Grid view for images, list view for documents
- [x] Filter by file type (Images, Videos, Documents, Audio)
- [x] Download button for each file

---

## 🟡 Phase 2: Medium Features

### 4. Advanced Mentions (@channel, @here, @online)
**Status**: ✅ Complete

Special mentions to notify groups of users.

**Backend Requirements:**
- [x] Parse special mentions in message content
- [x] `@channel`: Notify all members
- [x] `@here`: Notify all online members
- [x] `@online`: Show list of online users
- [x] Create notifications for each mentioned user

**Frontend Requirements:**
- [x] Autocomplete for special mentions
- [x] Visual distinction for special mentions
- [x] Confirmation dialog for @channel (warns about notifying X people)

---

### 5. Threaded Conversations
**Status**: ✅ Complete

Dedicated side-panel for in-depth discussions on a specific message.

**Backend Requirements:**
- [x] Add `threadCount` to Message model
- [x] Create API: `GET /api/messages/:id/thread`
- [x] Thread messages are stored with `parentMessageId`

**Frontend Requirements:**
- [x] "Start Thread" action on messages
- [x] Thread panel that slides out from the right
- [x] Thread count indicator on parent messages
- [x] Real-time thread updates

---

### 6. Global Search
**Status**: ✅ Complete

Search messages and files across all accessible channels.

**Backend Requirements:**
- [x] Create API: `GET /api/search?q=...`
- [x] Full-text search on message content
- [x] Filter by channel, user, date range, file type
- [x] Pagination for results

**Frontend Requirements:**
- [x] Global search bar in header (Cmd/Ctrl + K)
- [x] Search results page with filters
- [x] Jump to message in context
- [x] Recent searches history

---

### 7. Granular Notifications
**Status**: ✅ Complete

Fine-grained control over notification preferences.

**Backend Requirements:**
- [x] Add notification settings to User model
- [x] Per-channel notification preferences
- [x] Keyword alerts list
- [x] DND schedule

**Frontend Requirements:**
- [x] Notification settings page
- [x] Per-channel mute/unmute
- [x] Keyword highlights configuration
- [x] DND schedule picker

---

### 8. Voice Messages
**Status**: ✅ Complete

Record and send audio messages.

**Backend Requirements:**
- [x] Accept audio file uploads (Added support for `audio/*` in `upload.routes.ts`)
- [x] Store waveform and duration metadata (Added to Message and Attachment models)

**Frontend Requirements:**
- [x] Record button in chat input (Supports stop/cancel/send flow)
- [x] Recording UI with timer (Real-time volume visualizer)
- [x] Waveform visualizer for playback (Custom `VoiceMessage` component)
- [x] Inline audio player in messages

---

## 🔴 Phase 3: Hard Features

### 9. Kanban Task Boards
**Status**: ⬜ Pending

Per-channel task management with drag-and-drop boards.

**Backend Requirements:**
- [ ] Create Task model (title, description, assignee, due date, labels, column)
- [ ] Create Board model (columns, channel reference)
- [ ] CRUD APIs for tasks and boards
- [ ] Real-time task updates

**Frontend Requirements:**
- [ ] "Tasks" tab in channel view
- [ ] Drag-and-drop Kanban board
- [ ] Task detail modal
- [ ] Assignee picker, due date, labels
- [ ] Board column customization

---

### 10. Shared Knowledge Base (Wiki)
**Status**: ⬜ Pending

Collaborative documentation per channel.

**Backend Requirements:**
- [ ] Create WikiPage model (title, content, channel, author, versions)
- [ ] CRUD APIs with version history
- [ ] Markdown or rich text storage

**Frontend Requirements:**
- [ ] "Docs" tab in channel view
- [ ] Rich text editor (Tiptap or similar)
- [ ] Page navigation sidebar
- [ ] Version history viewer

---

### 11. Huddles (Voice & Video)
**Status**: ⬜ Pending

Quick voice/video calls within channels.

**Backend Requirements:**
- [ ] WebRTC signaling server
- [ ] Huddle room management
- [ ] Participant tracking

**Frontend Requirements:**
- [ ] "Start Huddle" button in channel header
- [ ] Audio/video controls
- [ ] Screen sharing
- [ ] Participant list with mute states
- [ ] Floating mini-player when navigating away

---

### 12. Live Collaborative Canvas
**Status**: ⬜ Pending

Real-time whiteboard for brainstorming.

**Backend Requirements:**
- [ ] Canvas state storage (shapes, text, drawings)
- [ ] CRDT or OT for conflict resolution
- [ ] Real-time sync via WebSocket

**Frontend Requirements:**
- [ ] Canvas component with drawing tools
- [ ] Shape library (rectangles, circles, arrows)
- [ ] Text annotations
- [ ] Multi-cursor presence
- [ ] Export as image

---

## 🚀 Current Sprint

**Focus**: Phase 1 - Easy Features

Starting with **Custom Status & Presence** as it requires minimal backend changes and provides immediate user value.

---

## 📝 Notes

- All features should follow existing code patterns and design system
- Real-time updates via WebSocket where applicable
- Mobile-responsive design considerations
- Accessibility (ARIA labels, keyboard navigation)

---

*Last Updated: 2026-01-11*

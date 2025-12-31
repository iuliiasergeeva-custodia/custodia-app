# News Admin Editor

## Setup

1. Set the `ADMIN_KEY` environment variable in your `.env` file (or use `ADMIN_API_KEY` as fallback):
   ```
   ADMIN_KEY=your-secure-password-here
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The admin page is available at: `/pages/admin/news`

## Usage

### Creating a Post

1. Visit `/pages/admin/news` and enter the admin password
2. Fill in the form:
   - **Title** (required): The post title
   - **Date**: Optional, defaults to current date/time
   - **Excerpt**: Optional, auto-generated from content if empty
   - **Content** (required): The main post content
   - **Media Files**: Upload images or videos (multiple files supported)
3. Click "Save Post"

### Editing a Post

1. Find the post in the "Existing Posts" list
2. Click the edit icon (pencil)
3. Modify the fields as needed
4. Click "Save Post"

### Deleting a Post

1. Find the post in the "Existing Posts" list
2. Click the delete icon (trash)
3. Confirm deletion

## File Storage

- News posts are stored in: `/frontend/data/news.json`
- Media files are stored in: `/frontend/assets/news/`

## API Endpoints

- `GET /api/news` - Public endpoint to fetch all posts
- `POST /api/admin/news` - Create or update a post (requires X-ADMIN-KEY header)
- `DELETE /api/admin/news/:id` - Delete a post (requires X-ADMIN-KEY header)
- `POST /api/admin/news/upload` - Upload media files (requires X-ADMIN-KEY header)

## Security

- Admin endpoints require the `X-ADMIN-KEY` header matching the `ADMIN_KEY` environment variable
- The admin password is stored in `sessionStorage` (cleared on logout or browser close)
- Never commit the `.env` file with your admin key to version control

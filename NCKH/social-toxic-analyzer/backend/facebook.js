/**
 * facebook.js
 * Lấy bài viết & bình luận từ một Facebook Page (Fanpage) qua Graph API,
 * để đưa vào engine phân tích (detector.js).
 *
 * YÊU CẦU:
 *  - Bạn phải là admin của Page đó.
 *  - Cần tạo Facebook App tại https://developers.facebook.com,
 *    lấy Page Access Token (không phải User Access Token) với quyền:
 *      pages_read_engagement, pages_show_list
 *  - Page Access Token loại "never expire" nên tạo qua Graph API Explorer
 *    rồi đổi sang long-lived token (xem README phần Facebook).
 *
 * GIỚI HẠN QUAN TRỌNG:
 *  - Facebook GROUP: từ sau các thay đổi chính sách quyền riêng tư (2018+),
 *    Meta gần như không còn cấp quyền groups_access_member_info / đọc bài viết
 *    Group cho ứng dụng thông thường nữa (chỉ dành cho số ít đối tác được duyệt
 *    riêng). Vì vậy tool này CHỈ hỗ trợ Page, không hỗ trợ Group.
 *  - Facebook giới hạn số lượng request theo giờ (rate limit) — nếu Page có
 *    rất nhiều bài viết/bình luận, cần đồng bộ theo lô, không lấy hết 1 lần.
 */

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Gọi Graph API, tự xử lý lỗi trả về dạng { error: {...} }
 */
async function graphGet(path, params) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error.message || 'Lỗi Facebook Graph API');
    err.fbError = data.error;
    throw err;
  }
  return data;
}

/**
 * Lấy danh sách bài viết gần đây của Page
 * @param {string} pageId
 * @param {string} accessToken - Page Access Token
 * @param {number} limit - số bài viết tối đa
 */
async function getPagePosts(pageId, accessToken, limit = 25) {
  const data = await graphGet(`/${pageId}/posts`, {
    fields: 'id,message,created_time,permalink_url',
    limit,
    access_token: accessToken,
  });
  return data.data || [];
}

/**
 * Lấy bình luận của 1 bài viết (có phân trang tự động, giới hạn maxComments)
 * @param {string} postId
 * @param {string} accessToken
 * @param {number} maxComments
 */
async function getPostComments(postId, accessToken, maxComments = 200) {
  const comments = [];
  let after = undefined;

  while (comments.length < maxComments) {
    const data = await graphGet(`/${postId}/comments`, {
      fields: 'id,message,from,created_time',
      limit: 100,
      after,
      access_token: accessToken,
    });

    comments.push(...(data.data || []));

    const next = data.paging && data.paging.cursors && data.paging.next;
    if (!next || !data.data || data.data.length === 0) break;
    after = data.paging.cursors.after;
  }

  return comments.slice(0, maxComments);
}

/**
 * Đồng bộ toàn bộ: lấy N bài viết gần nhất + bình luận của từng bài,
 * trả về danh sách item chuẩn hoá để đưa vào analyzeBatch()
 */
async function fetchPageContent({ pageId, accessToken, postLimit = 10, commentsPerPost = 100 }) {
  if (!pageId || !accessToken) {
    throw new Error('Thiếu pageId hoặc accessToken');
  }

  const posts = await getPagePosts(pageId, accessToken, postLimit);
  const items = [];

  for (const post of posts) {
    // Bình luận trên bài viết -> văn bản cần phân tích
    let comments = [];
    try {
      comments = await getPostComments(post.id, accessToken, commentsPerPost);
    } catch (err) {
      console.error(`Lỗi lấy bình luận bài ${post.id}:`, err.message);
      continue; // bỏ qua bài này, tiếp tục các bài khác
    }

    for (const c of comments) {
      if (!c.message) continue; // bỏ comment chỉ có sticker/ảnh, không có text
      items.push({
        id: c.id,
        text: c.message,
        author: c.from ? c.from.name : null,
        timestamp: c.created_time,
        source: 'facebook',
        sourcePostId: post.id,
        sourcePostUrl: post.permalink_url || null,
      });
    }

    // Tuỳ chọn: cũng có thể phân tích luôn nội dung bài viết (post.message)
    if (post.message) {
      items.push({
        id: post.id,
        text: post.message,
        author: null, // bài do Page đăng, không phải học sinh
        timestamp: post.created_time,
        source: 'facebook_post',
        sourcePostId: post.id,
        sourcePostUrl: post.permalink_url || null,
      });
    }
  }

  return items;
}

module.exports = { fetchPageContent, getPagePosts, getPostComments };

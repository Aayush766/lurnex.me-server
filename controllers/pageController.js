const Page = require('../models/pageModel');

const normalizeSourceUrl = (value) => {
  if (typeof value !== 'string') return '';
  const source = value.trim();
  if (!source) return '';
  // Store paths only, consistently with a single leading slash and no duplicate separators.
  let path = source;
  if (/^https?:\/\//i.test(source)) {
    try { path = new URL(source).pathname; } catch (_) { return ''; }
  }
  path = path.split(/[?#]/, 1)[0].replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  return `/${path.replace(/^\/+|\/+$/g, '')}`;
};

// CMS HTML is admin-authored, but scripts, inline event handlers, and executable URLs
// must not survive storage and later execute when rendered by the public site.
const sanitizeHtml = (html) => String(html || '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<\s*(script|iframe|object|embed|base|meta|link)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  .replace(/<\s*(script|iframe|object|embed|base|meta|link)\b[^>]*\/?>/gi, '')
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/\s+(href|src|xlink:href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, ' $1="#"');

const pageData = (page) => ({
  id: page._id.toString(),
  title: page.title,
  excerpt: page.excerpt,
  content: page.content,
  sourceUrl: page.sourceUrl,
  seoTitle: page.seoTitle,
  metaDescription: page.metaDescription,
  metaKeywords: page.metaKeywords,
  status: page.status,
  createdAt: page.createdAt,
  updatedAt: page.updatedAt,
});

const fields = ['title', 'excerpt', 'content', 'sourceUrl', 'seoTitle', 'metaDescription', 'metaKeywords', 'status'];
const validateInput = (body, partial = false) => {
  const data = {};
  for (const key of fields) if (Object.prototype.hasOwnProperty.call(body, key)) data[key] = body[key];
  if (!partial && (!String(data.title || '').trim() || !String(data.sourceUrl || '').trim())) {
    return 'title and sourceUrl are required';
  }
  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || !data.title.trim()) return 'title is required';
    data.title = data.title.trim();
  }
  if (data.sourceUrl !== undefined) {
    data.sourceUrl = normalizeSourceUrl(data.sourceUrl);
    if (!data.sourceUrl) return 'sourceUrl must be a valid path';
  }
  for (const [key, max] of [['excerpt', 500], ['seoTitle', 70], ['metaDescription', 320]]) {
    if (data[key] !== undefined && (typeof data[key] !== 'string' || data[key].length > max)) return `${key} must be a string no longer than ${max} characters`;
  }
  if (data.content !== undefined && typeof data.content !== 'string') return 'content must be an HTML string';
  if (data.content !== undefined) data.content = sanitizeHtml(data.content);
  if (data.metaKeywords !== undefined) {
    if (!Array.isArray(data.metaKeywords) || !data.metaKeywords.every((item) => typeof item === 'string' && item.length <= 100)) return 'metaKeywords must be an array of strings (maximum 100 characters each)';
    data.metaKeywords = data.metaKeywords.map((item) => item.trim()).filter(Boolean);
  }
  if (data.status !== undefined && !['draft', 'published'].includes(data.status)) return 'status must be draft or published';
  return data;
};

const handleError = (res, error) => {
  if (error.code === 11000) return res.status(409).json({ message: 'A page with this sourceUrl already exists.' });
  if (error.name === 'CastError') return res.status(404).json({ message: 'Page not found.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
  return res.status(500).json({ message: error.message || 'Server Error' });
};

exports.createPage = async (req, res) => {
  const data = validateInput(req.body);
  if (typeof data === 'string') return res.status(400).json({ message: data });
  try {
    const page = await Page.create(data);
    return res.status(201).json({ data: pageData(page) });
  } catch (error) { return handleError(res, error); }
};

exports.getPages = async (req, res) => {
  try {
    const query = {};
    if (['draft', 'published'].includes(req.query.status)) query.status = req.query.status;
    if (req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ title: { $regex: escaped, $options: 'i' } }, { sourceUrl: { $regex: escaped, $options: 'i' } }];
    }
    const pages = await Page.find(query).sort({ updatedAt: -1 });
    return res.json({ data: pages.map(pageData) });
  } catch (error) { return handleError(res, error); }
};

exports.getPage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found.' });
    return res.json({ data: pageData(page) });
  } catch (error) { return handleError(res, error); }
};

exports.updatePage = async (req, res) => {
  const data = validateInput(req.body, true);
  if (typeof data === 'string') return res.status(400).json({ message: data });
  if (!Object.keys(data).length) return res.status(400).json({ message: 'At least one page field is required.' });
  try {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found.' });
    Object.assign(page, data);
    await page.save();
    return res.json({ data: pageData(page) });
  } catch (error) { return handleError(res, error); }
};

exports.deletePage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found.' });
    await page.deleteOne();
    return res.json({ message: 'Page deleted successfully.' });
  } catch (error) { return handleError(res, error); }
};

const setStatus = (status) => async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found.' });
    page.status = status;
    await page.save();
    return res.json({ data: pageData(page) });
  } catch (error) { return handleError(res, error); }
};
exports.publishPage = setStatus('published');
exports.unpublishPage = setStatus('draft');

exports.getPublishedPageBySource = async (req, res) => {
  const sourceUrl = normalizeSourceUrl(req.query.source);
  if (!sourceUrl) return res.status(400).json({ message: 'source is required and must be a valid path.' });
  try {
    const page = await Page.findOne({ sourceUrl, status: 'published' });
    if (!page) return res.status(404).json({ message: 'Page not found.' });
    return res.json({ data: pageData(page) });
  } catch (error) { return handleError(res, error); }
};

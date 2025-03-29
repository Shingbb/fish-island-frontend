import React, {useState} from 'react';
import {Card, Image, Button, message} from 'antd';
import {BilibiliOutlined, LinkOutlined, FileOutlined, DownloadOutlined, StarOutlined, StarFilled} from '@ant-design/icons';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypePrism from 'rehype-prism-plus';
import 'prismjs/themes/prism-tomorrow.css';
import styles from './index.less';
import {parseWebPageUsingGet} from '@/services/backend/webParserController';
import DOMPurify from 'dompurify';

const DOUYIN_ICON = 'https://lf1-cdn-tos.bytegoofy.com/goofy/ies/douyin_web/public/favicon.ico';
const CODEFATHER_ICON = 'https://www.codefather.cn/favicon.ico';
const STORAGE_KEY = 'favorite_emoticons';

interface MessageContentProps {
  content: string;
}

interface WebPageInfo {
  title?: any;
  description?: any;
  favicon?: string;
}

interface Emoticon {
  thumbSrc: string;
  idx: number;
  source: string;
  isError?: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({content}) => {
  const [webPages, setWebPages] = useState<Record<any, WebPageInfo>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [favoriteEmoticons, setFavoriteEmoticons] = useState<Emoticon[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  // URL匹配正则表达式
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  // 图片标签匹配正则表达式
  const imgRegex = /\[img\](.*?)\[\/img\]/g;
  // 文件标签匹配正则表达式
  const fileRegex = /\[file\](.*?)\[\/file\]/g;

  // 截断文本到指定长度
  const truncateText = (text: string, maxLength: number = 20) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // 获取网页信息
  const fetchWebPageInfo = async (url: string) => {
    setLoading(prev => ({...prev, [url]: true}));
    try {
      const response = await parseWebPageUsingGet({url});
      if (response.code === 0 && response.data) {
        setWebPages(prev => ({
          ...prev,
          [url]: {
            title: response.data?.title || '未知标题',
            description: response.data?.description || '暂无描述',
            favicon: response.data?.favicon,
          }
        }));
      }
    } catch (error) {
      console.error('获取网页信息失败:', error);
      setWebPages(prev => ({
        ...prev,
        [url]: {
          title: '未知网页',
          description: '获取网页信息失败',
          favicon: undefined,
        }
      }));
    } finally {
      setLoading(prev => ({...prev, [url]: false}));
    }
  };

  // 处理文件下载
  const handleFileDownload = (url: string) => {
    // 从URL中提取文件名
    const fileName = url.split('/').pop() || '未知文件';

    // 创建一个临时的a标签来触发下载
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 检查是否是收藏的表情
  const isFavorite = (url: string) => {
    return favoriteEmoticons.some(
      (fav) => fav.thumbSrc === url
    );
  };

  // 切换收藏状态
  const toggleFavorite = (url: string) => {
    const newEmoticon: Emoticon = {
      thumbSrc: url,
      idx: Date.now(), // 使用时间戳作为唯一标识
      source: 'chat',
      isError: false
    };

    const newFavorites = isFavorite(url)
      ? favoriteEmoticons.filter(
          (fav) => fav.thumbSrc !== url
        )
      : [...favoriteEmoticons, newEmoticon];

    setFavoriteEmoticons(newFavorites);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
  };

  // 渲染图片
  const renderImage = (url: string, key: string) => {
    return (
      <div key={key} className={styles.imageContainer}>
        <Image
          src={url}
          alt="图片"
          className={styles.messageImage}
          preview={{
            mask: false
          }}
        />
        <Button
          type="text"
          size="small"
          icon={isFavorite(url) ? <StarFilled style={{ color: '#ffd700' }} /> : <StarOutlined />}
          className={styles.favoriteButton}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(url);
          }}
        />
      </div>
    );
  };

  // 渲染文件
  const renderFile = (url: string, key: string) => {
    const fileName = url.split('/').pop() || '未知文件';
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

    // 获取文件图标
    const getFileIcon = (ext: string) => {
      // 可以根据文件类型返回不同的图标
      const iconMap: { [key: string]: React.ReactNode } = {
        pdf: <FileOutlined style={{ color: '#ff4d4f' }} />,
        doc: <FileOutlined style={{ color: '#1890ff' }} />,
        docx: <FileOutlined style={{ color: '#1890ff' }} />,
        xls: <FileOutlined style={{ color: '#52c41a' }} />,
        xlsx: <FileOutlined style={{ color: '#52c41a' }} />,
        txt: <FileOutlined style={{ color: '#722ed1' }} />,
        // 可以添加更多文件类型
      };
      return iconMap[ext] || <FileOutlined style={{ color: '#1890ff' }} />;
    };

    return (
      <div key={key} className={styles.fileContainer}>
        <Card className={styles.fileCard} size="small">
          <div className={styles.fileInfo}>
            <span className={styles.fileIcon}>
              {getFileIcon(fileExt)}
            </span>
            <span className={styles.fileName} title={fileName}>
              {fileName}
            </span>
          </div>
          <Button
            type="link"
            className={styles.downloadButton}
            onClick={() => handleFileDownload(url)}
          >
            <DownloadOutlined /> 下载文件
          </Button>
        </Card>
      </div>
    );
  };

  // 渲染URL内容
  const renderUrl = (url: string, key: string) => {
    // 检查是否是B站链接
    if (url.includes('bilibili.com')) {
      if (!webPages[url] && !loading[url]) {
        fetchWebPageInfo(url);
      }

      return (
        <Card
          key={key}
          className={styles.linkCard}
          size="small"
          hoverable
        >
          <div className={styles.linkContent}>
            <BilibiliOutlined className={styles.linkIcon}/>
            <div className={styles.linkInfo}>
              {webPages[url] ? (
                <>
                  <div className={styles.videoTitle}>
                    {webPages[url].title}
                  </div>
                  {webPages[url].description && (
                    <div className={styles.videoDescription}>
                      {truncateText(webPages[url].description, 50)}
                    </div>
                  )}
                  <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkText}>
                    {truncateText(url, 30)}
                  </a>
                </>
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkText}>
                  {url}
                </a>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // 检查是否是抖音链接
    if (url.includes('douyin.com')) {
      if (!webPages[url] && !loading[url]) {
        fetchWebPageInfo(url);
      }

      return (
        <Card
          key={key}
          className={styles.linkCard}
          size="small"
          hoverable
        >
          <div className={styles.linkContent}>
            <img src={DOUYIN_ICON} alt="抖音" className={styles.linkIcon} style={{width: '16px', height: '16px'}}/>
            <div className={styles.linkInfo}>
              {webPages[url] ? (
                <>
                  <div className={styles.videoTitle}>
                    {webPages[url].title}
                  </div>
                  {webPages[url].description && (
                    <div className={styles.videoDescription}>
                      {truncateText(webPages[url].description, 50)}
                    </div>
                  )}
                  <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkText}>
                    {truncateText(url, 30)}
                  </a>
                </>
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkText}>
                  {url}
                </a>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // 检查是否是编程导航链接
    if (url.includes('codefather.cn/post/')) {
      if (!webPages[url] && !loading[url]) {
        fetchWebPageInfo(url);
      }

      return (
        <Card
          key={key}
          className={styles.linkCard}
          size="small"
          hoverable
        >
          <div className={styles.linkContent}>
            <img src={CODEFATHER_ICON} alt="编程导航" className={styles.linkIcon}
                 style={{width: '16px', height: '16px'}}/>
            <div className={styles.linkInfo}>
              {webPages[url] ? (
                <>
                  <div className={styles.videoTitle}>{webPages[url].title}</div>
                  {webPages[url].description && (
                    <div className={styles.videoDescription}>
                      {truncateText(webPages[url].description, 50)}
                    </div>
                  )}
                  <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkText}>
                    {truncateText(url, 30)}
                  </a>
                </>
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkText}>
                  {truncateText(url, 30)}
                </a>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // 其他URL显示为普通链接，但也尝试获取网页信息
    if (!webPages[url] && !loading[url]) {
      fetchWebPageInfo(url);
    }

    // @ts-ignore
    return (
      <Card
        key={key}
        className={styles.linkCard}
        size="small"
        hoverable
      >
        <div className={styles.linkContent}>
          {webPages[url]?.favicon ? (
            <img src={webPages[url].favicon} alt="网站图标" className={styles.linkIcon} style={{width: '16px', height: '16px'}}/>
          ) : (
            <LinkOutlined className={styles.linkIcon}/>
          )}
          <div className={styles.linkInfo}>
            {webPages[url] ? (
              <>
                <div className={styles.videoTitle}>{webPages[url].title}</div>
                {webPages[url].description && (
                  <div className={styles.videoDescription}>
                    {truncateText(webPages[url].description, 50)}
                  </div>
                )}
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkText}>
                  {truncateText(url, 30)}
                </a>
              </>
            ) : (
              <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkText}>
                {url}
              </a>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 添加安全的 HTML 渲染函数
  const sanitizeHtml = (html: string) => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class'],
      FORBID_TAGS: ['iframe', 'script', 'style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'object', 'embed', 'param', 'meta', 'link'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave', 'onblur', 'onfocus', 'onchange', 'onsubmit', 'onreset', 'onkeydown', 'onkeypress', 'onkeyup', 'onmousedown', 'onmouseup', 'onmousemove', 'onmousewheel', 'onwheel', 'onresize', 'onscroll', 'onabort', 'oncanplay', 'oncanplaythrough', 'oncuechange', 'ondurationchange', 'onemptied', 'onended', 'onerror', 'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress', 'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange', 'onwaiting', 'onbeforecopy', 'onbeforecut', 'onbeforepaste', 'oncopy', 'oncut', 'onpaste', 'onselect', 'onselectionchange', 'onselectstart', 'oncontextmenu', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'onblur', 'onfocus', 'onfocusin', 'onfocusout', 'onkeydown', 'onkeypress', 'onkeyup', 'onclick', 'ondblclick', 'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onwheel', 'onresize', 'onscroll', 'onabort', 'oncanplay', 'oncanplaythrough', 'oncuechange', 'ondurationchange', 'onemptied', 'onended', 'onerror', 'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress', 'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange', 'onwaiting', 'onbeforecopy', 'onbeforecut', 'onbeforepaste', 'oncopy', 'oncut', 'onpaste', 'onselect', 'onselectionchange', 'onselectstart', 'oncontextmenu', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop'],
    });
  };

  // 修改检测 iframe 语法的函数
  const checkIframeSyntax = (text: string) => {
    const iframeRegex = /<iframe[^>]*>.*?<\/iframe>/gi;
    return iframeRegex.test(text);
  };

  // 修改 ReactMarkdown 组件的配置
  const markdownComponents: Components = {
    // 自定义链接渲染，避免与我们的URL渲染冲突
    a: ({node, ...props}: { node?: any; [key: string]: any }) => {
      const href = props.href || '';
      if (href.match(urlRegex)) {
        return renderUrl(href, `markdown-url-${Date.now()}`);
      }
      return <a {...props} target="_blank" rel="noopener noreferrer" />;
    },
    // 自定义图片渲染，避免与我们的图片标签冲突
    img: ({node, ...props}: { node?: any; [key: string]: any }) => {
      const src = props.src || '';
      if (src.match(/^https?:\/\//)) {
        return renderImage(src, `img-${Date.now()}`);
      }
      return <img {...props} alt={props.alt || '图片'} />;
    },
    // 自定义 iframe 渲染，直接返回 null
    iframe: () => null,
    // 自定义 script 渲染，直接返回 null
    script: () => null,
    // 自定义 style 渲染，直接返回 null
    style: () => null,
  };

  // 修改 parseContent 函数
  const parseContent = () => {
    // 检查是否包含 iframe 语法
    if (checkIframeSyntax(content)) {
      return <div className={styles.messageContent}>消息包含不安全的 iframe 标签，已被过滤</div>;
    }

    let parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // 处理图片标签
    while ((match = imgRegex.exec(content)) !== null) {
      // 添加图片前的文本
      if (match.index > lastIndex) {
        const textBeforeImg = content.slice(lastIndex, match.index);
        // 处理文本中的URL
        const urlParts = textBeforeImg.split(urlRegex);
        urlParts.forEach((urlPart, urlIndex) => {
          if (urlPart.match(urlRegex)) {
            parts.push(renderUrl(urlPart, `url-${match!.index}-${urlIndex}`));
          } else if (urlPart) {
            parts.push(
              <ReactMarkdown
                key={`markdown-${match!.index}-${urlIndex}`}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypePrism]}
                components={markdownComponents}
              >
                {sanitizeHtml(urlPart)}
              </ReactMarkdown>
            );
          }
        });
      }
      // 添加图片组件
      parts.push(renderImage(match[1], `img-${match.index}`));
      lastIndex = match.index + match[0].length;
    }

    // 处理文件标签
    const remainingContent = content.slice(lastIndex);
    let fileLastIndex = 0;
    let fileMatch: RegExpExecArray | null;

    while ((fileMatch = fileRegex.exec(remainingContent)) !== null) {
      // 处理文件前的文本（包括URL解析）
      if (fileMatch.index > fileLastIndex) {
        const textBeforeFile = remainingContent.slice(fileLastIndex, fileMatch.index);
        // 处理文本中的URL
        const urlParts = textBeforeFile.split(urlRegex);
        urlParts.forEach((urlPart, urlIndex) => {
          if (urlPart.match(urlRegex)) {
            parts.push(renderUrl(urlPart, `url-file-${fileMatch!.index}-${urlIndex}`));
          } else if (urlPart) {
            parts.push(
              <ReactMarkdown
                key={`markdown-file-${fileMatch!.index}-${urlIndex}`}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypePrism]}
                components={markdownComponents}
              >
                {sanitizeHtml(urlPart)}
              </ReactMarkdown>
            );
          }
        });
      }
      // 添加文件组件
      parts.push(renderFile(fileMatch[1], `file-${fileMatch.index}`));
      fileLastIndex = fileMatch.index + fileMatch[0].length;
    }

    // 处理剩余文本中的URL
    if (fileLastIndex < remainingContent.length) {
      const finalText = remainingContent.slice(fileLastIndex);
      const urlParts = finalText.split(urlRegex);
      urlParts.forEach((urlPart, urlIndex) => {
        if (urlPart.match(urlRegex)) {
          parts.push(renderUrl(urlPart, `url-final-${urlIndex}`));
        } else if (urlPart) {
          parts.push(
            <ReactMarkdown
              key={`markdown-final-${urlIndex}`}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypePrism]}
              components={markdownComponents}
            >
              {sanitizeHtml(urlPart)}
            </ReactMarkdown>
          );
        }
      });
    }

    return parts;
  };

  return <div className={styles.messageContent}>{parseContent()}</div>;
};

export default MessageContent;

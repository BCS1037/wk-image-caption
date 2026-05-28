import {
	ViewUpdate,
	PluginValue,
	EditorView,
	ViewPlugin,
} from '@codemirror/view';

// ============================================================
// 设置接口与默认值
// ============================================================

export interface ImageCaptionSettings {
	showFileNameAsCaption: boolean;
	captionAlign: 'left' | 'center' | 'right';
	captionStyle: 'italic' | 'normal';
}

// ============================================================
// Caption 智能解析 Helper 函数
// ============================================================

/**
 * 智能解析图片说明文字，过滤可能存在的尺寸参数
 */
export function parseCaption(
	altText: string | null,
	showFileName: boolean,
	srcText: string | null
): string | null {
	if (!altText || altText.trim() === '') {
		if (showFileName && srcText) {
			const fileName = srcText.split('/').pop() || srcText;
			return decodeURIComponent(fileName);
		}
		return null;
	}

	const parts = altText.split('|');
	const sizeRegex = /^\d+(x\d+)?$/;

	if (parts.length > 0) {
		const lastPart = parts[parts.length - 1].trim();
		if (sizeRegex.test(lastPart)) {
			parts.pop();
		}
	}

	const caption = parts.join('|').trim();

	if (caption === '') {
		if (showFileName && srcText) {
			const fileName = srcText.split('/').pop() || srcText;
			return decodeURIComponent(fileName);
		}
		return null;
	}

	return caption;
}

// ============================================================
// CodeMirror 6 实时预览静态视图插件
// ============================================================

class ImageCaptionLPPlugin implements PluginValue {
	private observer: MutationObserver;
	private view: EditorView;

	constructor(view: EditorView) {
		this.view = view;

		// 首次挂载时扫描
		this.scanAndInject(view.dom);

		// 使用 MutationObserver 监听 DOM 树的增减变化，确保在滚动或折叠动作后即时发现新图片
		this.observer = new MutationObserver(() => {
			this.scanAndInject(this.view.dom);
		});

		this.observer.observe(view.dom, {
			childList: true,
			subtree: true,
		});
	}

	update(update: ViewUpdate) {
		// 在文档内容改变或视口发生移动时重新扫描
		if (update.docChanged || update.viewportChanged) {
			this.scanAndInject(update.view.dom);
		}
	}

	destroy() {
		// 严防内存泄露：销毁时断开监听
		if (this.observer) {
			this.observer.disconnect();
		}
	}

	private getSettings(): ImageCaptionSettings {
		const plugin = (app as any).plugins?.plugins?.['wk-image-caption'];
		return plugin ? plugin.settings : {
			showFileNameAsCaption: false,
			captionAlign: 'center',
			captionStyle: 'italic',
		};
	}

	private scanAndInject(dom: HTMLElement) {
		const settings = this.getSettings();
		const imgs = dom.querySelectorAll('img');

		imgs.forEach((img: HTMLImageElement) => {
			// 获取相关的容器
			const wrapper = img.closest('.image-wrapper') as HTMLElement | null;
			const embedParent = img.closest('.image-embed') || img.closest('.cm-embed-block') as HTMLElement | null;

			// 检查 DOM 树中是否真正存在属于该图片的 caption 元素，保证幂等性
			// 优先使用 embedParent 级别检查，覆盖 wrapper + embedParent 同时存在的场景
			let existingCaption: HTMLElement | null = null;
			if (embedParent) {
				existingCaption = embedParent.querySelector(':scope > .image-caption') as HTMLElement | null;
			}
			if (!existingCaption && wrapper) {
				const next = wrapper.nextElementSibling;
				if (next && next.classList.contains('image-caption')) {
					existingCaption = next as HTMLElement;
				}
			}
			if (!existingCaption && !wrapper && !embedParent) {
				const next = img.nextElementSibling;
				if (next && next.classList.contains('image-caption')) {
					existingCaption = next as HTMLElement;
				}
			}

			if (existingCaption) {
				// 已经存在，更新样式类（响应设置实时改变）
				this.applyStyleClasses(existingCaption, settings);
				return;
			}

			// 解析 alt 和 src 元数据
			const altText = img.getAttribute('alt');
			const resolvedAlt = altText || (embedParent ? embedParent.getAttribute('alt') : null);
			const resolvedSrc = img.getAttribute('src') || (embedParent ? embedParent.getAttribute('src') : null);

			const captionText = parseCaption(resolvedAlt, settings.showFileNameAsCaption, resolvedSrc);

			if (captionText) {
				img.dataset.hasCaption = 'true';

				// 严格使用 activeDocument，防止多开 Popout 报错
				const captionEl = activeDocument.createElement('div');
				captionEl.className = 'image-caption';
				captionEl.setText(captionText);
				this.applyStyleClasses(captionEl, settings);

				if (wrapper) {
					wrapper.after(captionEl);
				} else if (embedParent) {
					// 注入到容器内部最后
					if (!embedParent.querySelector(':scope > .image-caption')) {
						embedParent.appendChild(captionEl);
					}
				} else {
					img.after(captionEl);
				}
			}
		});
	}

	private applyStyleClasses(el: HTMLElement, settings: ImageCaptionSettings) {
		el.className = 'image-caption';
		el.classList.add(`align-${settings.captionAlign}`);
		el.classList.add(`style-${settings.captionStyle}`);
	}
}

// ============================================================
// 导出静态扩展
// ============================================================

export const imageCaptionExtension = ViewPlugin.fromClass(ImageCaptionLPPlugin);

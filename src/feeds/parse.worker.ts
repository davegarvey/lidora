import { parseFeed } from './parse';

self.onmessage = (event: MessageEvent<{ xml: string; baseUrl?: string }>) => {
  self.postMessage(parseFeed(event.data.xml, event.data.baseUrl));
};

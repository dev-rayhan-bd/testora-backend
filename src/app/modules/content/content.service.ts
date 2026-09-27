import { TContentPayload } from './content.interface';
import { Content } from './content.model';

const TYPE_TITLE_MAP: Record<string, string> = {
  'privacy-policy': 'Privacy Policy',
  'terms-and-condition': 'Terms and Conditions',
  'about-us': 'About Us',
};

const createOrUpdatePage = async (payload: TContentPayload) => {
  const data = {
    ...payload,
    title: payload.title || TYPE_TITLE_MAP[payload.type] || payload.type,
  };
  const page = await Content.findOneAndUpdate({ type: payload.type }, data, {
    upsert: true,
    new: true,
  });
  return page;
};

const getContentByType = async (type: string) => {
  const page = await Content.findOne({ type });
  return page;
};

const getAllContent = async () => {
  return Content.find();
};

export const ContentService = {
  createOrUpdatePage,
  getContentByType,
  getAllContent,
};

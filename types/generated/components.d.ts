import type { Schema, Struct } from '@strapi/strapi';

export interface CodeCode extends Struct.ComponentSchema {
  collectionName: 'components_code_codes';
  info: {
    displayName: 'code';
    icon: 'code';
  };
  attributes: {
    code: Schema.Attribute.Text;
  };
}

export interface ContentBlocksContentBlocks extends Struct.ComponentSchema {
  collectionName: 'components_content_blocks_content_blocks';
  info: {
    displayName: 'content_blocks';
    icon: 'apps';
  };
  attributes: {};
}

export interface ImageImage extends Struct.ComponentSchema {
  collectionName: 'components_image_images';
  info: {
    displayName: 'image';
    icon: 'chartBubble';
  };
  attributes: {
    image: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
  };
}

export interface RichTextBlocks extends Struct.ComponentSchema {
  collectionName: 'components_rich_text_blocks';
  info: {
    displayName: 'blocks';
    icon: 'apps';
  };
  attributes: {};
}

export interface RichTextRichText extends Struct.ComponentSchema {
  collectionName: 'components_rich_text_rich_texts';
  info: {
    displayName: 'rich-text';
  };
  attributes: {
    richtext: Schema.Attribute.Blocks;
  };
}

export interface TableHtmltable extends Struct.ComponentSchema {
  collectionName: 'components_table_htmltables';
  info: {
    displayName: 'htmltable';
  };
  attributes: {
    htmltable: Schema.Attribute.Text;
  };
}

export interface YoutubeVideoYoutubeVideo extends Struct.ComponentSchema {
  collectionName: 'components_youtube_video_youtube_videos';
  info: {
    displayName: 'youtube_video';
  };
  attributes: {
    youtube_video: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'code.code': CodeCode;
      'content-blocks.content-blocks': ContentBlocksContentBlocks;
      'image.image': ImageImage;
      'rich-text.blocks': RichTextBlocks;
      'rich-text.rich-text': RichTextRichText;
      'table.htmltable': TableHtmltable;
      'youtube-video.youtube-video': YoutubeVideoYoutubeVideo;
    }
  }
}

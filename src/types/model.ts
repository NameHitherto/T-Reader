export const MODEL_PURPOSES = ['chat', 'image', 'embedding', 'rerank'] as const
export type ModelPurpose = (typeof MODEL_PURPOSES)[number]

export const PROVIDER_TYPES = ['OpenAI', 'Anthropic', 'Other'] as const
export type ProviderType = (typeof PROVIDER_TYPES)[number]

export interface ModelProvider {
  purpose: ModelPurpose
  providerType: ProviderType
  baseUrl: string
  endpoint: string
  modelId: string
  apiKey: string
}

export type ModelProviderMap = Record<ModelPurpose, ModelProvider | null>

export const PURPOSE_LABELS: Record<ModelPurpose, string> = {
  chat: '对话',
  embedding: '嵌入',
  rerank: '重排序',
  image: '图像',
}

export const ENDPOINT_PRESETS: Record<ProviderType, Partial<Record<ModelPurpose, string[]>>> = {
  OpenAI: {
    chat: ['/v1/chat/completions', '/v1/responses'],
    image: ['/v1/images/generations'],
    embedding: ['/v1/embeddings'],
    rerank: ['/v1/rerank'],
  },
  Anthropic: {
    chat: ['/v1/messages'],
    image: ['/v1/images/generations'],
    embedding: ['/v1/embeddings'],
    rerank: ['/v1/rerank'],
  },
  Other: {},
}

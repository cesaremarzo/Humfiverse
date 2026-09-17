/** The topics the guide assistant answers from (§2.100).
 *
 * This list is the whole of the widget's guided mode: with no AI configured
 * on the backend, these written answers are the only thing it says, and it
 * says so rather than imitating a conversation it cannot hold. With AI
 * configured they stay, as the starting chips and as the fallback whenever
 * the backend cannot answer.
 *
 * Each id maps to three translated strings, in every locale:
 *   assistant.kb.<id>.q     the topic, as the visitor would ask it
 *   assistant.kb.<id>.a     the answer, kept to a few sentences
 *   assistant.kb.<id>.keys  comma-separated words that should reach it
 *
 * `server/assistant-knowledge.js` carries the same facts for the AI mode.
 * The two are meant to agree: change a fee, a role or a flow in one and
 * change it in the other, in the same commit.
 */
export interface AssistantTopic {
  id: string;
  /** An icon name from mock-data/icons.json. */
  icon: string;
  /** Page this topic is about, offered as a button under the answer. */
  route?: string;
  /** i18n key for that button's label. */
  routeLabel?: string;
  /** Topics offered as the next question after this one. */
  related: string[];
}

export const ASSISTANT_TOPICS: AssistantTopic[] = [
  { id: 'what', icon: 'sparkles', route: '/marketplace', routeLabel: 'nav.marketplace', related: ['buy', 'campaigns', 'risks'] },
  { id: 'start', icon: 'wallet', related: ['buy', 'verification', 'risks'] },
  { id: 'buy', icon: 'coins', route: '/marketplace', routeLabel: 'nav.marketplace', related: ['start', 'fees', 'royalties'] },
  { id: 'campaigns', icon: 'pulse', route: '/marketplace', routeLabel: 'nav.marketplace', related: ['milestones', 'fees', 'risks'] },
  { id: 'milestones', icon: 'checkCircle', related: ['campaigns', 'studios', 'risks'] },
  { id: 'royalties', icon: 'music', route: '/portfolio', routeLabel: 'nav.portfolio', related: ['buy', 'resale', 'risks'] },
  { id: 'resale', icon: 'users', route: '/portfolio', routeLabel: 'nav.portfolio', related: ['fees', 'royalties'] },
  { id: 'fees', icon: 'scale', related: ['buy', 'campaigns', 'resale'] },
  { id: 'verification', icon: 'shield', route: '/kyc', routeLabel: 'assistant.goVerification', related: ['start', 'buy'] },
  { id: 'artists', icon: 'mic', route: '/for-artists', routeLabel: 'assistant.goArtists', related: ['campaigns', 'milestones', 'fees'] },
  { id: 'studios', icon: 'strings', route: '/studio', routeLabel: 'footer.studioLink', related: ['milestones', 'campaigns'] },
  { id: 'risks', icon: 'alert', related: ['what', 'royalties', 'fees'] }
];

/** The chips shown before the visitor has asked anything. */
export const ASSISTANT_STARTERS = ['what', 'start', 'buy', 'campaigns', 'artists'];

export const ASSISTANT_TOPIC_IDS = ASSISTANT_TOPICS.map((t) => t.id);

export function assistantTopic(id: string): AssistantTopic | undefined {
  return ASSISTANT_TOPICS.find((t) => t.id === id);
}

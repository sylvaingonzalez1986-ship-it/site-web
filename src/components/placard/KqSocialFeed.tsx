"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight, Bookmark, Brain, Heart, MessageCircle, Repeat2, Send, UserRound } from "lucide-react";
import { ChanvrierAvatar } from "@/components/contest/ChanvrierAvatar";
import type { KqSocialChoice, KqSocialHistoryEntry, KqSocialPlatform } from "@/lib/kanab-quest-social";
import { getKqSocialFeedOutcome, type KqSocialFeedPresentation, type KqSocialFeedThread } from "@/lib/kanab-quest-social-feed";
import type { KqSocialPlayer } from "@/lib/kanab-quest-social-player";
import styles from "./KqSocialFeed.module.css";

type Feed = KqSocialFeedPresentation;
type Author = Feed["author"];
type ComposerMedia = Pick<Feed, "image" | "imageAlt" | "artwork" | "thread">;
const intentions = { reach: "Se faire voir", craft: "Soigner le fond", care: "Garder le lien" } as const;
const fallbackArtwork = (key: Feed["image"]) => `/app/kanab-quest/social/${key}.webp`;
const portraits: Record<Exclude<Author["avatar"], "player">, string> = { mila: "/contest/avatars/sylvain-v4/head-bob.webp", jade: "/contest/avatars/sylvain-v4/head-bun.webp", noe: "/contest/avatars/sylvain-v4/head-quiff.webp", ines: "/contest/avatars/sylvain-v4/head-braids.webp", sam: "/contest/avatars/sylvain-v4/head-buzz.webp" };

function Avatar({ author, player, ring = false }: { author: Author; player: KqSocialPlayer; ring?: boolean }) {
  return <span className={`${styles.avatar} ${ring ? styles.ring : ""}`} data-person={author.avatar} data-social-player-avatar={author.avatar === "player" ? true : undefined} aria-hidden="true"><span>{author.avatar === "player" ? <><UserRound className={styles.avatarFallback} strokeWidth={1.7} />{player.profile ? <ChanvrierAvatar profile={player.profile} view="portrait" className={styles.playerPortrait} /> : null}</> : <Image src={portraits[author.avatar]} alt="" width={768} height={768} sizes="130px" />}</span></span>;
}

function Identity({ author, player, subtitle, ring = false }: { author: Author; player: KqSocialPlayer; subtitle?: string; ring?: boolean }) {
  return <div className={styles.identity}><Avatar author={author} player={player} ring={ring} /><div><strong>{author.name}</strong><span>{subtitle ?? author.handle}</span></div></div>;
}

function Illustration({ scenarioId, image, imageAlt, artwork, player, compact = false }: { scenarioId: string; image: Feed["image"]; imageAlt: string; artwork?: Feed["artwork"]; player: KqSocialPlayer; compact?: boolean }) {
  const placement = artwork?.playerPlacement ?? (image === "workshop" ? "left" : image === "community" ? "center" : "none");
  const showPlayer = placement !== "none" && !!player.profile;
  return <figure className={styles.illustration} data-social-illustration={image} data-social-artwork={artwork ? scenarioId : undefined} data-player-placement={placement} aria-label={artwork?.alt ?? imageAlt} role="img"><Image className={styles.sceneBackground} src={artwork?.src ?? fallbackArtwork(image)} alt="" width={1024} height={1024} sizes={compact ? "(max-width: 520px) 75vw, 320px" : "(max-width: 760px) 100vw, 600px"} />{showPlayer && player.profile ? <span className={styles.sceneFigure} data-social-player-scene={image} data-social-player-artwork={scenarioId} aria-hidden="true"><span className={styles.figureFallback}><UserRound size={28} strokeWidth={1.7} /><span>Ton avatar</span></span><ChanvrierAvatar profile={player.profile} view="full" className={styles.playerFigure} /></span> : null}</figure>;
}

function PostGlyphs({ platform }: { platform: KqSocialPlatform }) {
  return <div className={styles.postGlyphs} aria-hidden="true">{platform === "instagram" ? <><Heart size={21} /><MessageCircle size={21} /><Send size={20} /><Bookmark size={20} className={styles.bookmark} /></> : <><MessageCircle size={17} /><Repeat2 size={17} /><Heart size={17} /><ArrowUpRight size={17} /></>}</div>;
}

function Comments({ comments, platform, player, targetCommentId }: { comments: Feed["comments"]; platform: KqSocialPlatform; player: KqSocialPlayer; targetCommentId?: string }) {
  return <div className={styles.comments} aria-label={platform === "instagram" ? "Commentaires de ta publication" : "Réponses et citations de ta publication"}>{comments.map(comment => <article key={comment.id} className={styles.comment} data-social-comment={comment.id} data-comment-kind={comment.kind ?? "reply"}>
    <Avatar author={comment.author} player={player} /><div className={styles.commentContent}>{targetCommentId === comment.id ? <strong className={styles.targetComment}>Le commentaire auquel tu peux répondre</strong> : null}{platform === "x" ? <><div className={styles.replyIdentity}><strong>{comment.author.name}</strong><span>{comment.author.handle}</span></div>{comment.kind === "quote" ? <span className={styles.quoteLabel}><Repeat2 size={12} aria-hidden="true" />A repris la conversation</span> : <span className={styles.replyTo}>En réponse au fil</span>}</> : null}<div className={comment.kind === "quote" && platform === "x" ? styles.quote : undefined}><p>{platform === "instagram" ? <strong>{comment.author.handle} </strong> : null}{comment.text}</p></div>{platform === "x" ? <PostGlyphs platform="x" /> : null}</div>
  </article>)}</div>;
}

function Discussion({ thread, platform, player, choosing = false }: { thread: KqSocialFeedThread; platform: KqSocialPlatform; player: KqSocialPlayer; choosing?: boolean }) {
  return <article className={styles.originalPost} data-social-thread={thread.scenarioId} aria-label="La discussion sous ta publication">
    <header className={styles.postHeader}><Identity author={player} player={player} /><span className={styles.draftBadge}>Déjà publié</span></header>
    <div className={styles.postBody}><p className={styles.caption}>{thread.text}</p></div>
    <Comments comments={thread.comments} platform={platform} player={player} targetCommentId={choosing ? thread.targetCommentId : undefined} />
  </article>;
}

export function KqSocialFeed({ platform, scenarioId, media, player, children }: { platform: KqSocialPlatform; scenarioId: string; media: ComposerMedia; player: KqSocialPlayer; children: ReactNode }) {
  return <div className={styles.feed} data-social-feed={platform} data-social-composer={scenarioId}>
    <header className={styles.appHeader}><span className={styles.wordmark}>{platform === "instagram" ? "Instagram" : "𝕏"}</span><div><strong>{media.thread ? "Sous ta publication" : "Nouvelle publication"}</strong><span>Kanab Quest · simulation</span></div></header>
    {media.thread ? <Discussion thread={media.thread} platform={platform} player={player} choosing /> : <div className={styles.originalPost} aria-label="Préparer ta publication">
      <header className={styles.postHeader}><Identity author={player} player={player} ring={platform === "instagram"} /><span className={styles.draftBadge}>Brouillon</span></header>
      <div className={styles.composerMedia} data-social-composer-media data-social-attachment={platform === "x" ? true : undefined}><Illustration scenarioId={scenarioId} image={media.image} imageAlt={media.imageAlt} artwork={media.artwork} player={player} compact={platform === "x"} /></div>
      <p className={styles.mediaNote}>La situation que tu vas raconter.</p>
    </div>}
    <div className={styles.drafts}><header className={styles.draftsHeading}><span className={styles.pencilMark} aria-hidden="true"><Send size={18} /></span><div><h5>{media.thread ? "Tu réagis comment ?" : "Choisis ton message."}</h5><p>{media.thread ? "Réponds sous ton post ou laisse le commentaire sans réponse." : "Une seule publication fera avancer l’histoire."}</p></div></header>{children}</div>
  </div>;
}

export function KqSocialDraft({ platform, text, choice, cost, disabled, reason, onPublish, player, replyTo, children }: { platform: KqSocialPlatform; text: string; choice: KqSocialChoice; cost: number; disabled: boolean; reason: string; onPublish: () => void; player: KqSocialPlayer; replyTo?: string; children?: ReactNode }) {
  const action = choice.action ?? "publish", ignored = action === "ignore";
  const verb = ignored ? "Ne pas répondre" : action === "reply" ? "Répondre" : "Publier";
  return <article className={styles.draft} data-social-draft={ignored ? undefined : choice.id} data-social-decision={ignored ? choice.id : undefined} data-draft-platform={platform}>
    {ignored ? <p className={styles.draftText}>Tu laisses ce commentaire sans réponse. Il reste visible ; aucun message n’est publié en ton nom.</p> : <><div className={styles.draftHeader}><Identity author={player} player={player} /><span className={styles.draftBadge}>{action === "reply" ? "Réponse envisagée" : "Brouillon"}</span></div>
    {action === "reply" && replyTo ? <span className={styles.draftReply}>En réponse à {replyTo}</span> : null}<p className={styles.draftText}>{text}</p></>}
    <div className={styles.decision}><div className={styles.decisionHeading}><span>{intentions[choice.intent]}</span><span className={styles.cost}><Brain size={14} aria-hidden="true" />{cost} pts de mental</span></div><h5>{choice.label}</h5><div className={styles.tradeoff}><p><b>À gagner.</b> {choice.upside}</p><p><b>En contrepartie.</b> {choice.downside}</p></div></div>
    <div className={styles.publishRow}><span>{reason}</span><button type="button" disabled={disabled} onClick={onPublish} aria-label={`${verb} : ${choice.label}`} data-social-choice={choice.id}>{verb}{ignored ? null : <Send size={15} aria-hidden="true" />}</button></div>{children}
  </article>;
}

export function KqSocialPublishedPost({ entry, player }: { entry: KqSocialHistoryEntry; player: KqSocialPlayer }) {
  const publication = getKqSocialFeedOutcome(entry, player);
  if (!publication || !entry.platform) return null;
  if (publication.thread) {
    const ignored = publication.action === "ignore";
    return <div className={`${styles.feed} ${styles.published}`} data-social-feed={entry.platform} data-social-reaction={entry.id}>
      <header className={styles.publishedHeading}><span>{ignored ? "Commentaire laissé sans réponse" : "Ta réponse enregistrée"}</span><small>Kanab Quest · simulation</small></header>
      <Discussion thread={publication.thread} platform={entry.platform} player={player} />
      {ignored ? <p className={styles.mediaNote}>Tu n’as pas répondu à ce commentaire. Il reste visible et les échanges précédents sont conservés.</p> : <><p className={styles.replyContext}>Ta réponse à {publication.thread.comments.find(comment => comment.id === publication.thread!.targetCommentId)?.author.handle}</p><Comments comments={[{ id: `${entry.id}:player-reply`, author: player, text: publication.text }, ...publication.comments]} platform={entry.platform} player={player} /></>}
    </div>;
  }
  return <div className={`${styles.feed} ${styles.published}`} data-social-feed={entry.platform} data-social-published={entry.id}>
    <header className={styles.publishedHeading}><span>Ta publication enregistrée</span><small>Kanab Quest · simulation</small></header>
    <article className={styles.originalPost}><header className={styles.postHeader}><Identity author={publication.author} player={player} ring={entry.platform === "instagram"} /><Send size={17} aria-hidden="true" /></header>{entry.platform === "instagram" ? <Illustration scenarioId={entry.scenarioId} image={publication.image} imageAlt={publication.imageAlt} artwork={publication.artwork} player={player} compact /> : null}<div className={styles.postBody}><p className={styles.caption}>{publication.text}</p>{entry.platform === "x" ? <div className={styles.attachment} data-social-attachment><Illustration scenarioId={entry.scenarioId} image={publication.image} imageAlt={publication.imageAlt} artwork={publication.artwork} player={player} compact /></div> : null}<PostGlyphs platform={entry.platform} /></div><Comments comments={publication.comments} platform={entry.platform} player={player} /></article>
  </div>;
}

"use client";

import { useEffect, useState } from 'react';
import { cannabisReferenceTopic, findCannabisReferenceArticle, loadCannabisReferenceCatalog } from '@/lib/kanab-quest-cannabis-reference';
import type { CannabisReferenceCatalog } from '@/lib/kanab-quest-cannabis-reference-types';
import { KqCannabisArticle } from './KqCannabisArticle';
import { KqSchoolEncyclopedia } from './KqSchoolEncyclopedia';

export function KqCannabisReference({ moduleId, passageId, onOpen, onHome }: {
  moduleId?: string;
  passageId?: string;
  onOpen: (moduleId?: string, passageId?: string) => void;
  onHome: () => void;
}) {
  const [catalog, setCatalog] = useState<CannabisReferenceCatalog>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    void loadCannabisReferenceCatalog().then(value => { if (current) setCatalog(value); }, () => { if (current) setError(true); });
    return () => { current = false; };
  }, [retry]);
  if (error) return <div role="alert"><p>L’encyclopédie de QuizzShow n’a pas pu s’ouvrir.</p><button type="button" onClick={() => { setError(false); setRetry(value => value + 1); }}>Réessayer</button></div>;
  if (!catalog) return <p role="status">Ouverture de l’encyclopédie…</p>;
  const article = findCannabisReferenceArticle(catalog, moduleId, passageId);
  const topicId = cannabisReferenceTopic(passageId?.startsWith('library-theme-') ? passageId.slice(14) : moduleId);
  return <div data-cannabis-reference data-reference-origin={passageId} style={{ minWidth: 0 }}>
    {article ? <KqCannabisArticle key={article.id} article={article} sources={catalog.sources}
      topic={catalog.topics.find(topic => topic.id === article.topicId)}
      relatedArticles={[...catalog.articles, ...catalog.records].filter(item => article.relatedArticleIds.includes(item.id))}
      onOpenArticle={id => onOpen('reference', id)} onOpenTopic={id => onOpen(undefined, `library-theme-${id}`)} onHome={onHome}/>
      : <KqSchoolEncyclopedia key={topicId || 'library'} initialShelfId={topicId} onOpen={onOpen}/>}
  </div>;
}

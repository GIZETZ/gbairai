Applying changes to the GbairaiCardMobile component to handle guest users and authentication requirements.
```
```replit_final_file
import React from "react";
            import { GbairaiWithInteractions } from "@shared/schema";
            import { formatDistanceToNow } from "date-fns";
            import { fr } from "date-fns/locale";
            import { Heart, MessageCircle, Share2, MapPin, Send, X, User, ArrowLeft, Plus, MoreVertical, Trash2, Languages, Flag, ChevronDown, AlertTriangle, Camera } from "lucide-react";
            import { Button } from "@/components/ui/button";
            import { Input } from "@/components/ui/input";
            import {
              DropdownMenu,
              DropdownMenuContent,
              DropdownMenuItem,
              DropdownMenuTrigger,
            } from "@/components/ui/dropdown-menu";
            import { useInteractWithGbairai, useGbairaiComments } from "@/hooks/useGbairais";
            import { useAuth } from "@/hooks/use-auth";
            import { useToast } from "@/hooks/use-toast";
            import { CommentItem } from "./CommentItem";
            import { EmojiPicker } from "../Common/EmojiPicker";
            import { emotionConfig, getEmotionDisplay } from "@/components/Gbairai/GbairaiCard";
            import { ShareToConversationModal } from "./ShareToConversationModal";
            import { useState, useRef, useEffect } from "react";
            import html2canvas from "html2canvas";

            interface GbairaiCardMobileProps {
              gbairai: GbairaiWithInteractions;
              highlighted?: boolean;
              isGuest?: boolean;
              onAuthRequired?: () => void;
            }

            export function GbairaiCardMobile({ 
              gbairai, 
              highlighted = false,
              isGuest = false,
              onAuthRequired
            }: GbairaiCardMobileProps) {
              const { user } = useAuth();
              const { toast } = useToast();
              const interactMutation = useInteractWithGbairai();
              const [showCommentForm, setShowCommentForm] = useState(false);
              const [showComments, setShowComments] = useState(false);
              const [commentText, setCommentText] = useState("");
              const [activeCommentMenu, setActiveCommentMenu] = useState<{
                commentId: number;
                isOwner: boolean;
              } | null>(null);
              const [replyingTo, setReplyingTo] = useState<{
                commentId: number;
                username: string;
              } | null>(null);
              const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
              const [repliesOverlay, setRepliesOverlay] = useState<{
                isVisible: boolean;
                commentId: number | null;
                parentComment: any;
              }>({
                isVisible: false,
                commentId: null,
                parentComment: null
              });
              const [isCommentEditorFocused, setIsCommentEditorFocused] = useState(false);
              const [commentReplies, setCommentReplies] = useState<Record<number, any[]>>({});
              const [deleteConfirmation, setDeleteConfirmation] = useState<{
                show: boolean;
                commentId: number | null;
                commentContent: string;
              }>({
                show: false,
                commentId: null,
                commentContent: ''
              });

              // État optimiste pour les likes de commentaires
              const [optimisticLikes, setOptimisticLikes] = useState<Set<number>>(new Set());


              const { data: comments = [], isLoading: commentsLoading, refetch: refetchComments } = useGbairaiComments(gbairai.id);

              // Charger les réponses pour chaque commentaire
              useEffect(() => {
                const loadRepliesForComments = async () => {
                  const mainComments = comments.filter((comment: any) => !comment.parentCommentId);

                  for (const comment of mainComments as any[]) {
                    try {
                      const response = await fetch(`/api/comments/${comment.id}/replies`, {
                        credentials: 'include'
                      });
                      if (response.ok) {
                        const replies = await response.json();
                        setCommentReplies(prev => ({
                          ...prev,
                          [comment.id]: replies
                        }));
                      }
                    } catch (error) {
                      console.error('Erreur lors du chargement des réponses:', error);
                    }
                  }
                };

                if (comments.length > 0) {
                  loadRepliesForComments();
                }
              }, [comments]);

              // Nettoyer les likes optimistes après mise à jour des données
              useEffect(() => {
                if (gbairai.interactions.length > 0) {
                  // Supprimer les likes optimistes qui sont maintenant confirmés par le serveur
                  setOptimisticLikes(prev => {
                    const newSet = new Set(prev);
                    prev.forEach(commentId => {
                      const existingLike = gbairai.interactions.find(interaction => 
                        interaction.type === 'like' && 
                        interaction.userId === user?.id && 
                        interaction.parentCommentId === commentId
                      );
                      if (existingLike) {
                        newSet.delete(commentId);
                      }
                    });
                    return newSet;
                  });
                }
              }, [gbairai.interactions, user?.id]);

              const emotion = getEmotionDisplay(gbairai.emotion);

              const location = gbairai.location as any;
              const locationText = location ? `${location.city || location.region || 'Côte d\'Ivoire'}` : 'Côte d\'Ivoire';

              const timeAgo = formatDistanceToNow(new Date(gbairai.createdAt!), { 
                addSuffix: true,
                locale: fr 
              });

              const handleInteraction = async (type: string) => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                if (!user) {
                  toast({
                    title: "Connexion requise",
                    description: "Vous devez vous connecter pour interagir.",
                    variant: "destructive",
                  });
                  return;
                }

                // Vérifier que l'ID est valide
                if (!gbairai.id || isNaN(gbairai.id)) {
                  toast({
                    title: "Erreur",
                    description: "Impossible d'interagir avec ce Gbairai.",
                    variant: "destructive",
                  });
                  return;
                }

                // Pour les commentaires, ouvrir la vue commentaires au lieu de créer une interaction vide
                if (type === 'comment') {
                  setShowComments(true);
                  onCommentsToggle?.(true);
                  return;
                }

                // Pour le partage, ne pas traiter ici - géré par le menu de partage
                if (type === 'share') {
                  return;
                }

                try {
                  await interactMutation.mutateAsync({
                    gbairaiId: gbairai.id,
                    type: type as 'like' | 'comment' | 'share',
                    content: undefined,
                  });
                } catch (error) {
                  console.error('Erreur lors de l\'interaction:', error);
                  toast({
                    title: "Erreur",
                    description: "Impossible d'interagir pour le moment.",
                    variant: "destructive",
                  });
                }
              };

              const handleCommentSubmit = async () => {
                if (!commentText.trim()) {
                  toast({
                    title: "Erreur",
                    description: "Veuillez saisir un commentaire.",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  const commentData: any = {
                    gbairaiId: gbairai.id,
                    type: 'comment',
                    content: commentText.trim(),
                  };

                  // Si c'est une réponse, ajouter le parentCommentId
                  if (replyingTo) {
                    commentData.parentCommentId = replyingTo.commentId;
                  }

                  await interactMutation.mutateAsync(commentData);

                  setCommentText("");
                  setReplyingTo(null);

                  // Rafraîchir les commentaires
                  refetchComments();

                  // Si c'était une réponse, recharger les réponses pour ce commentaire
                  if (replyingTo?.commentId) {
                    try {
                      const response = await fetch(`/api/comments/${replyingTo.commentId}/replies`, {
                        credentials: 'include'
                      });
                      if (response.ok) {
                        const replies = await response.json();
                        setCommentReplies(prev => ({
                          ...prev,
                          [replyingTo.commentId]: replies
                        }));
                      }
                    } catch (error) {
                      console.error('Erreur lors du rechargement des réponses:', error);
                    }
                  }

                  // Si nous sommes dans l'overlay des réponses, ne pas fermer l'overlay
                  // L'overlay reste ouvert pour continuer la conversation

                  toast({
                    title: replyingTo ? "Réponse ajoutée" : "Commentaire ajouté",
                    description: replyingTo ? "Votre réponse a été publiée avec succès !" : "Votre commentaire a été publié avec succès !",
                  });
                } catch (error) {
                  console.error('Erreur lors du commentaire:', error);
                  toast({
                    title: "Erreur",
                    description: "Impossible d'ajouter le commentaire.",
                    variant: "destructive",
                  });
                }
              };

              // Removed old comment form handlers

              const handleCloseComments = () => {
                setShowComments(false);
                setCommentText("");
                setReplyingTo(null);
                onCommentsToggle?.(false);
              };

              // Gestion des touches d'échappement et prévention du scroll
              useEffect(() => {
                const handleKeyDown = (event: KeyboardEvent) => {
                  if (event.key === 'Escape') {
                    if (repliesOverlay.isVisible) {
                      // Fermer l'overlay des réponses en priorité
                      closeRepliesOverlay();
                    } else if (showComments) {
                      // Fermer les commentaires si l'overlay n'est pas ouvert
                      handleCloseComments();
                    }
                  }
                };

                // Empêcher le scroll du body quand les commentaires sont ouverts
                const preventBodyScroll = (e: TouchEvent | WheelEvent) => {
                  if (showComments || repliesOverlay.isVisible) {
                    e.preventDefault();
                  }
                };

                const preventBodyKeyboardScroll = (e: KeyboardEvent) => {
                  if ((showComments || repliesOverlay.isVisible) && 
                      ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
                    e.preventDefault();
                  }
                };

                // Ajouter l'event listener quand les commentaires ou l'overlay sont ouverts
                if (showComments || repliesOverlay.isVisible) {
                  document.addEventListener('keydown', handleKeyDown);
                  document.addEventListener('keydown', preventBodyKeyboardScroll);
                  document.addEventListener('touchmove', preventBodyScroll, { passive: false });
                  document.addEventListener('wheel', preventBodyScroll, { passive: false });

                  // Bloquer le scroll du body
                  document.body.style.overflow = 'hidden';
                  document.body.style.position = 'fixed';
                  document.body.style.width = '100%';
                  document.body.style.height = '100%';

                  return () => {
                    document.removeEventListener('keydown', handleKeyDown);
                    document.removeEventListener('keydown', preventBodyKeyboardScroll);
                    document.removeEventListener('touchmove', preventBodyScroll);
                    document.removeEventListener('wheel', preventBodyScroll);

                    // Restaurer le scroll du body
                    document.body.style.overflow = '';
                    document.body.style.position = '';
                    document.body.style.width = '';
                    document.body.style.height = '';
                  };
                }
              }, [showComments, repliesOverlay.isVisible]);

              // Gestion du menu déroulant de commentaire
              const handleCommentMenuToggle = (commentId: number, isOwner: boolean) => {
                if (activeCommentMenu?.commentId === commentId) {
                  // Fermer le menu s'il est déjà ouvert pour ce commentaire
                  setActiveCommentMenu(null);
                } else {
                  // Ouvrir le menu pour ce commentaire
                  setActiveCommentMenu({
                    commentId,
                    isOwner
                  });
                }
              };

              const closeCommentMenu = () => {
                setActiveCommentMenu(null);
              };

              // Fonction pour vérifier si un commentaire est aimé par l'utilisateur actuel
              const isCommentLikedByUser = (commentId: number) => {
                if (!user) return false;

                // Vérifier d'abord l'état optimiste pour une réponse instantanée
                if (optimisticLikes.has(commentId)) {
                  return true;
                }

                // Chercher dans les interactions du gbairai si l'utilisateur a liké ce commentaire
                const userLike = gbairai.interactions.find(interaction => 
                  interaction.type === 'like' && 
                  interaction.userId === user.id && 
                  interaction.parentCommentId === commentId
                );

                return !!userLike;
              };

              // Fonction pour compter le nombre de likes spécifiquement pour un commentaire
              const getCommentLikesCount = (commentId: number) => {
                let count = gbairai.interactions.filter(interaction => 
                  interaction.type === 'like' && 
                  interaction.parentCommentId === commentId
                ).length;

                // Ajouter 1 si le commentaire est dans les likes optimistes et l'utilisateur ne l'a pas encore liké
                if (optimisticLikes.has(commentId) && !gbairai.interactions.some(interaction => 
                  interaction.type === 'like' && 
                  interaction.userId === user?.id && 
                  interaction.parentCommentId === commentId
                )) {
                  count += 1;
                }

                return count;
              };

              const handleLikeComment = async (commentId: number) => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                if (!user) {
                  toast({
                    title: "Connexion requise",
                    description: "Vous devez être connecté pour aimer un commentaire",
                    variant: "destructive",
                  });
                  return;
                }

                // Vérifier si déjà liké
                if (isCommentLikedByUser(commentId)) {
                  toast({
                    title: "Déjà aimé",
                    description: "Vous avez déjà aimé ce commentaire",
                    variant: "destructive",
                  });
                  return;
                }

                // Mise à jour optimiste instantanée
                setOptimisticLikes(prev => new Set([...prev, commentId]));

                try {
                  // Utiliser l'API d'interaction existante avec type "like"
                  const response = await fetch(`/api/gbairais/${gbairai.id}/interact`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                      type: 'like',
                      parentCommentId: commentId // Le commentaire ciblé
                    })
                  });

                  if (response.ok) {
                    const result = await response.json();

                    // Recharger les commentaires pour mettre à jour le compteur de likes
                    refetchComments();

                    // Recharger les réponses si nécessaire
                    const allComments = [...comments, ...Object.values(commentReplies).flat()];
                    const likedComment = allComments.find((comment: any) => comment.id === commentId);

                    if (likedComment && likedComment.parentCommentId) {
                      // Si c'est une réponse, recharger les réponses du commentaire parent
                      const response = await fetch(`/api/comments/${likedComment.parentCommentId}/replies`, {
                        credentials: 'include'
                      });
                      if (response.ok) {
                        const replies = await response.json();
                        setCommentReplies(prev => ({
                          ...prev,
                          [likedComment.parentCommentId]: replies
                        }));
                      }
                    }

                    toast({
                      title: "👍",
                      description: "Commentaire aimé !",
                    });
                  } else {
                    // Annuler la mise à jour optimiste en cas d'erreur
                    setOptimisticLikes(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(commentId);
                      return newSet;
                    });

                    const error = await response.json();
                    if (response.status === 409) {
                      toast({
                        title: "Déjà aimé",
                        description: "Vous avez déjà aimé ce commentaire",
                        variant: "destructive",
                      });
                    } else {
                      throw new Error(error.message || 'Erreur lors du like');
                    }
                  }
                } catch (error) {
                  // Annuler la mise à jour optimiste en cas d'erreur
                  setOptimisticLikes(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(commentId);
                    return newSet;
                  });

                  toast({
                    title: "Erreur",
                    description: "Impossible d'aimer le commentaire",
                    variant: "destructive",
                  });
                }
              };

              // Fermer le menu déroulant avec Échap
              useEffect(() => {
                const handleEscape = (event: KeyboardEvent) => {
                  if (event.key === 'Escape') {
                    closeCommentMenu();
                    if (deleteConfirmation.show) {
                      cancelDeleteComment();
                    }
                  }
                };

                if (activeCommentMenu || deleteConfirmation.show) {
                  document.addEventListener('keydown', handleEscape);
                  return () => {
                    document.removeEventListener('keydown', handleEscape);
                  };
                }
              }, [activeCommentMenu, deleteConfirmation.show]);

              const handleDeleteComment = async (commentId?: number) => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                const idToDelete = commentId || activeCommentMenu?.commentId;
                if (!idToDelete) return;

                // Trouver le commentaire à supprimer pour afficher son contenu
                const allComments = [...comments, ...Object.values(commentReplies).flat()];
                const commentToDelete = allComments.find((comment: any) => comment.id === idToDelete);

                if (!commentToDelete) return;

                // Afficher la boîte de confirmation
                setDeleteConfirmation({
                  show: true,
                  commentId: idToDelete,
                  commentContent: commentToDelete.content
                });

                closeCommentMenu();
              };

              const confirmDeleteComment = async () => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                if (!deleteConfirmation.commentId) return;

                try {
                  const response = await fetch(`/api/interactions/${deleteConfirmation.commentId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                  });

                  if (response.ok) {
                    // Recharger les commentaires
                    refetchComments();

                    // Recharger les réponses si nécessaire
                    const allComments = [...comments, ...Object.values(commentReplies).flat()];
                    const deletedComment = allComments.find((comment: any) => comment.id === deleteConfirmation.commentId);

                    if (deletedComment && deletedComment.parentCommentId) {
                      // Si c'est une réponse, recharger les réponses du commentaire parent
                      const response = await fetch(`/api/comments/${deletedComment.parentCommentId}/replies`, {
                        credentials: 'include'
                      });
                      if (response.ok) {
                        const replies = await response.json();
                        setCommentReplies(prev => ({
                          ...prev,
                          [deletedComment.parentCommentId]: replies
                        }));
                      }
                    }

                    toast({
                      title: "Commentaire supprimé",
                      description: "Le commentaire a été supprimé avec succès",
                    });
                  } else {
                    throw new Error('Erreur lors de la suppression');
                  }
                } catch (error) {
                  toast({
                    title: "Erreur",
                    description: "Impossible de supprimer le commentaire",
                    variant: "destructive",
                  });
                }

                // Fermer la boîte de confirmation
                setDeleteConfirmation({
                  show: false,
                  commentId: null,
                  commentContent: ''
                });
              };

              const cancelDeleteComment = () => {
                setDeleteConfirmation({
                  show: false,
                  commentId: null,
                  commentContent: ''
                });
              };

              const handleTranslateComment = async () => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                if (!activeCommentMenu) return;

                const comment = comments.find((c: any) => c.id === activeCommentMenu.commentId);
                if (!comment) return;

                try {
                  const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ text: comment.content })
                  });

                  if (response.ok) {
                    const result = await response.json();
                    toast({
                      title: "Traduction",
                      description: result.translatedText,
                    });
                  } else {
                    throw new Error('Erreur lors de la traduction');
                  }
                } catch (error) {
                  toast({
                    title: "Erreur",
                    description: "Impossible de traduire le commentaire",
                    variant: "destructive",
                  });
                }
                closeCommentMenu();
              };

              const handleReportComment = async () => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                if (!activeCommentMenu) return;

                try {
                  const response = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                      type: 'comment',
                      targetId: activeCommentMenu.commentId,
                      reason: 'Contenu inapproprié'
                    })
                  });

                  if (response.ok) {
                    toast({
                      title: "Signalement envoyé",
                      description: "Le commentaire a été signalé aux modérateurs",
                    });
                  } else {
                    throw new Error('Erreur lors du signalement');
                  }
                } catch (error) {
                  toast({
                    title: "Erreur",
                    description: "Impossible de signaler le commentaire",
                    variant: "destructive",
                  });
                }
                closeCommentMenu();
              };

              const cardRef = useRef<HTMLDivElement>(null);

              const captureAndShare = async () => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                if (!cardRef.current) return null;

                try {
                  // Créer une version temporaire de la carte sans les boutons d'interaction
                  const tempCard = cardRef.current.cloneNode(true) as HTMLElement;

                  // Supprimer les éléments d'interaction de la copie temporaire
                  const interactionElements = tempCard.querySelectorAll(
                    '.interaction-buttons, [data-interaction="true"], button, .dropdown-menu, .more-button'
                  );
                  interactionElements.forEach(el => el.remove());

                  // Ajouter la copie temporaire au DOM (invisible)
                  tempCard.style.position = 'absolute';
                  tempCard.style.left = '-9999px';
                  tempCard.style.width = '400px';
                  tempCard.style.background = 'white';
                  tempCard.style.padding = '20px';
                  tempCard.style.borderRadius = '12px';
                  tempCard.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                  document.body.appendChild(tempCard);

                  // Capturer l'image
                  const canvas = await html2canvas(tempCard, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    width: 400,
                    height: tempCard.offsetHeight
                  });

                  // Nettoyer l'élément temporaire
                  document.body.removeChild(tempCard);

                  // Convertir en blob
                  return new Promise<Blob | null>((resolve) => {
                    canvas.toBlob((blob) => {
                      resolve(blob);
                    }, 'image/png', 0.95);
                  });
                } catch (error) {
                  console.error('Erreur lors de la capture:', error);
                  return null;
                }
              };

              const handleExternalShare = async () => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                try {
                  const shareUrl = `${window.location.origin}/gbairai/${gbairai.id}`;
                  const shareText = `${gbairai.content.substring(0, 100)}${gbairai.content.length > 100 ? '...' : ''}`;

                  // Capturer l'image de la carte
                  const imageBlob = await captureAndShare();

                  const shareData: any = {
                    title: 'Gbairai - Découvrez cette histoire',
                    text: shareText,
                    url: shareUrl,
                  };

                  // Ajouter l'image si elle a été capturée avec succès
                  if (imageBlob) {
                    const imageFile = new File([imageBlob], 'gbairai-capture.png', { type: 'image/png' });
                    shareData.files = [imageFile];
                  }

                  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                  } else {
                    // Fallback: copier le lien et télécharger l'image si possible
                    await navigator.clipboard.writeText(shareUrl);

                    if (imageBlob) {
                      const url = URL.createObjectURL(imageBlob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'gbairai-capture.png';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);

                      toast({
                        title: "Lien copié et image téléchargée",
                        description: "Le lien a été copié et l'image a été téléchargée",
                      });
                    } else {
                      toast({
                        title: "Lien copié",
                        description: "Le lien du Gbairai a été copié dans le presse-papiers",
                      });
                    }
                  }
                } catch (error) {
                  toast({
                    title: "Erreur",
                    description: "Impossible de partager le contenu",
                    variant: "destructive"
                  });
                }
              };

              const handleReportGbairai = async () => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                if (!user) {
                  toast({
                    title: "Connexion requise",
                    description: "Vous devez être connecté pour signaler un Gbairai",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  const response = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                      type: 'gbairai',
                      targetId: gbairai.id,
                      reason: 'Contenu inapproprié'
                    })
                  });

                  if (response.ok) {
                    toast({
                      title: "Signalement envoyé",
                      description: "Le Gbairai a été signalé aux modérateurs",
                    });
                  } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erreur lors du signalement');
                  }
                } catch (error) {
                  toast({
                    title: "Erreur",
                    description: "Impossible de signaler le Gbairai",
                    variant: "destructive",
                  });
                }
              };

              const handleReplyToComment = (comment: any, parentUsername?: string) => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                const username = comment.user?.username || comment.username;
                // Si on est dans l'overlay, on répond au commentaire parent
                if (repliesOverlay.isVisible && repliesOverlay.commentId) {
                  setReplyingTo({ commentId: repliesOverlay.commentId, username });
                } else {
                  setReplyingTo({ commentId: comment.id, username });
                }
                // Auto-tag the parent comment author or the specific user being replied to
                const taggedUser = parentUsername || username;
                setCommentText(`@${taggedUser} `);
              };

              const toggleReplies = (commentId: number) => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                setExpandedReplies(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(commentId)) {
                    newSet.delete(commentId);
                  } else {
                    newSet.add(commentId);
                  }
                  return newSet;
                });
              };

              const openRepliesOverlay = async (commentId: number, parentComment: any) => {
                if (isGuest) {
                  onAuthRequired?.();
                  return;
                }
                // Recharger les réponses avant d'ouvrir l'overlay
                try {
                  const response = await fetch(`/api/comments/${commentId}/replies`, {
                    credentials: 'include'
                  });
                  if (response.ok) {
                    const replies = await response.json();
                    setCommentReplies(prev => ({
                      ...prev,
                      [commentId]: replies
                    }));
                  }
                } catch (error) {
                  console.error('Erreur lors du chargement des réponses:', error);
                }

                setRepliesOverlay({
                  isVisible: true,
                  commentId,
                  parentComment
                });
              };

              const closeRepliesOverlay = () => {
                setRepliesOverlay({
                  isVisible: false,
                  commentId: null,
                  parentComment: null
                });
              };

              // Séparer les commentaires principaux des réponses
              const mainComments = comments.filter((comment: any) => !comment.parentCommentId);


              // Fonction pour récupérer les réponses d'un commentaire
              const getRepliesForComment = (commentId: number) => {
                return commentReplies[commentId] || [];
              };

              // Fonction pour organiser les réponses par ordre chronologique des réponses taguées
              const getOrganizedReplies = (commentId: number) => {
                const replies = getRepliesForComment(commentId);
                if (replies.length === 0) return [];

                // Identifier les réponses qui sont des réponses directes (taguées)
                const taggedReplies: any[] = [];
                const responseMap: { [key: string]: any[] } = {};

                // Parcourir toutes les réponses
                replies.forEach((reply: any) => {
                  // Extraire le tag @username du début du contenu
                  const tagMatch = reply.content.match(/^@(\w+)/);
                  if (tagMatch) {
                    const taggedUsername = tagMatch[1];

                    // Vérifier si c'est une réponse directe au commentaire parent
                    // (tag correspond à l'auteur du commentaire parent)
                    const parentComment = repliesOverlay.parentComment;
                    const parentUsername = parentComment?.user?.username || parentComment?.username;

                    if (taggedUsername === parentUsername) {
                      // C'est une réponse directe au commentaire parent
                      taggedReplies.push(reply);
                      responseMap[reply.id] = [];
                    } else {
                      // C'est une réponse à une autre réponse
                      // Trouver la réponse taguée correspondante
                      const targetReply = replies.find((r: any) => 
                        (r.user?.username || r.username) === taggedUsername
                      );

                      if (targetReply) {
                        if (!responseMap[targetReply.id]) {
                          responseMap[targetReply.id] = [];
                        }
                        responseMap[targetReply.id].push(reply);
                      } else {
                        // Si on ne trouve pas la réponse taguée, traiter comme réponse directe
                        taggedReplies.push(reply);
                        responseMap[reply.id] = [];
                      }
                    }
                  } else {
                    // Pas de tag, traiter comme réponse directe
                    taggedReplies.push(reply);
                    responseMap[reply.id] = [];
                  }
                });

                // Trier les réponses taguées par ordre chronologique
                taggedReplies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                // Construire la liste organisée
                const organizedReplies: any[] = [];
                taggedReplies.forEach(taggedReply => {
                  // Ajouter la réponse taguée
                  organizedReplies.push(taggedReply);

                  // Ajouter ses réponses associées, triées par ordre chronologique
                  const responses = responseMap[taggedReply.id] || [];
                  responses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                  organizedReplies.push(...responses);
                });

                return organizedReplies;
              };

              // Fonction pour charger les réponses d'un commentaire
              const loadReplies = async (commentId: number) => {
                try {
                  const response = await fetch(`/api/comments/${commentId}/replies`);
                  if (response.ok) {
                    const replies = await response.json();
                    setCommentReplies(prev => ({
                      ...prev,
                      [commentId]: replies
                    }));
                  }
                } catch (error) {
                  console.error('Error loading replies:', error);
                }
              };

              // Charger les réponses pour tous les commentaires principaux
              useEffect(() => {
                if (mainComments.length > 0) {
                  mainComments.forEach((comment: any) => {
                    // Éviter de recharger si déjà chargé
                    if (!commentReplies[comment.id]) {
                      loadReplies(comment.id);
                    }
                  });
                }
              }, [mainComments.length]); // Dépendre seulement de la longueur pour éviter la boucle infinie

              return (
                <div 
                  className="gbairai-card-mobile"
                  style={{ 
                    '--emotion-color': emotion.color,
                  } as any}
                >
                <div 
                    ref={cardRef}
                    className="w-full h-full bg-gradient-to-br from-slate-900 via-gray-
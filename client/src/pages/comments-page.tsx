
import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Send, X, MessageCircle, Heart, MoreVertical, Trash2, Languages, Flag, User, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useInteractWithGbairai, useGbairaiComments } from "@/hooks/useGbairais";
import { CommentItem } from "@/components/Gbairai/CommentItem";
import { emotionConfig, getEmotionDisplay } from "@/components/Gbairai/GbairaiCard";
import { MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function CommentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const params = useParams();
  const gbairaiId = parseInt(params.id as string);
  const [, setLocation] = useLocation();
  
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    commentId: number;
    username: string;
  } | null>(null);
  const [commentReplies, setCommentReplies] = useState<Record<number, any[]>>({});
  const [activeCommentMenu, setActiveCommentMenu] = useState<{
    commentId: number;
    isOwner: boolean;
  } | null>(null);
  const [optimisticLikes, setOptimisticLikes] = useState<Set<number>>(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    commentId: number | null;
    commentContent: string;
  }>({
    show: false,
    commentId: null,
    commentContent: ''
  });

  const interactMutation = useInteractWithGbairai();

  // Récupérer le Gbairai
  const { data: gbairai, isLoading: gbairaiLoading } = useQuery({
    queryKey: [`/api/gbairais/${gbairaiId}`],
    enabled: !!gbairaiId,
  });

  // Récupérer les commentaires
  const { data: comments = [], isLoading: commentsLoading, refetch: refetchComments } = useGbairaiComments(gbairaiId);

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
        gbairaiId: gbairaiId,
        type: 'comment',
        content: commentText.trim(),
      };

      if (replyingTo) {
        commentData.parentCommentId = replyingTo.commentId;
      }

      await interactMutation.mutateAsync(commentData);

      setCommentText("");
      setReplyingTo(null);
      refetchComments();

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

  const handleReplyToComment = (comment: any) => {
    const username = comment.user?.username || comment.username;
    setReplyingTo({ commentId: comment.id, username });
    setCommentText(`@${username} `);
  };

  const isCommentLikedByUser = (commentId: number) => {
    if (!user || !gbairai) return false;

    if (optimisticLikes.has(commentId)) {
      return true;
    }

    const userLike = gbairai.interactions?.find((interaction: any) => 
      interaction.type === 'like' && 
      interaction.userId === user.id && 
      interaction.parentCommentId === commentId
    );

    return !!userLike;
  };

  const getCommentLikesCount = (commentId: number) => {
    if (!gbairai) return 0;
    
    let count = gbairai.interactions?.filter((interaction: any) => 
      interaction.type === 'like' && 
      interaction.parentCommentId === commentId
    ).length || 0;

    if (optimisticLikes.has(commentId) && !gbairai.interactions?.some((interaction: any) => 
      interaction.type === 'like' && 
      interaction.userId === user?.id && 
      interaction.parentCommentId === commentId
    )) {
      count += 1;
    }

    return count;
  };

  const handleLikeComment = async (commentId: number) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Vous devez être connecté pour aimer un commentaire",
        variant: "destructive",
      });
      return;
    }

    if (isCommentLikedByUser(commentId)) {
      toast({
        title: "Déjà aimé",
        description: "Vous avez déjà aimé ce commentaire",
        variant: "destructive",
      });
      return;
    }

    setOptimisticLikes(prev => new Set([...prev, commentId]));

    try {
      const response = await fetch(`/api/gbairais/${gbairaiId}/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'like',
          parentCommentId: commentId
        })
      });

      if (response.ok) {
        refetchComments();

        toast({
          title: "👍",
          description: "Commentaire aimé !",
        });
      } else {
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

  const handleDeleteComment = async (commentId: number) => {
    const allComments = [...comments, ...Object.values(commentReplies).flat()];
    const commentToDelete = allComments.find((comment: any) => comment.id === commentId);

    if (!commentToDelete) return;

    setDeleteConfirmation({
      show: true,
      commentId: commentId,
      commentContent: commentToDelete.content
    });
  };

  const confirmDeleteComment = async () => {
    if (!deleteConfirmation.commentId) return;

    try {
      const response = await fetch(`/api/interactions/${deleteConfirmation.commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        refetchComments();

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

  const handleCommentMenuToggle = (commentId: number, isOwner: boolean) => {
    if (activeCommentMenu?.commentId === commentId) {
      setActiveCommentMenu(null);
    } else {
      setActiveCommentMenu({ commentId, isOwner });
    }
  };

  const getRepliesForComment = (commentId: number) => {
    return commentReplies[commentId] || [];
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Connexion requise
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Veuillez vous connecter pour voir les commentaires
          </p>
        </div>
      </div>
    );
  }

  if (gbairaiLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!gbairai) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Gbairai introuvable
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Ce Gbairai n'existe pas ou n'est plus disponible
          </p>
          <Link href="/">
            <Button className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const emotion = getEmotionDisplay(gbairai.emotion);
  const location = gbairai.location as any;
  const locationText = location ? `${location.city || location.region || 'Côte d\'Ivoire'}` : 'Côte d\'Ivoire';
  const timeAgo = formatDistanceToNow(new Date(gbairai.createdAt!), { 
    addSuffix: true,
    locale: fr 
  });
  const mainComments = comments.filter((comment: any) => !comment.parentCommentId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Commentaires
              </h1>
              <div className="w-20"></div>
            </div>

            {/* Gbairai original miniaturisé */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{emotion.emoji}</span>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {emotion.label}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  <MapPin className="w-3 h-3" />
                  <span>{locationText}</span>
                </div>
              </div>
              <p className="text-gray-900 dark:text-white mb-2">
                {gbairai.content}
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                @{gbairai.user?.username || 'Anonyme'} • {timeAgo}
              </div>
            </div>
          </div>
        </div>

        {/* Commentaires */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Commentaires ({mainComments.length})
            </h2>
          </CardHeader>
          <CardContent className="space-y-4 max-h-96 overflow-y-auto">
            {commentsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  Chargement des commentaires...
                </p>
              </div>
            ) : mainComments.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">
                  Soyez le premier à commenter ce Gbairai !
                </p>
              </div>
            ) : (
              mainComments.map((comment: any) => (
                <div key={comment.id} className="space-y-2">
                  <CommentItem
                    comment={comment}
                    onReply={handleReplyToComment}
                    onLike={handleLikeComment}
                    onToggleMenu={handleCommentMenuToggle}
                    onDelete={handleDeleteComment}
                    onTranslate={() => {}}
                    onReport={() => {}}
                    isLiked={isCommentLikedByUser(comment.id)}
                    likesCount={getCommentLikesCount(comment.id)}
                    isMenuOpen={activeCommentMenu?.commentId === comment.id}
                    isOwner={comment.userId === user?.id}
                    currentUser={user}
                    repliesCount={getRepliesForComment(comment.id).length}
                  />
                  
                  {/* Réponses */}
                  {getRepliesForComment(comment.id).length > 0 && (
                    <div className="ml-8 space-y-2 border-l-2 border-gray-200 dark:border-gray-600 pl-4">
                      {getRepliesForComment(comment.id).map((reply: any) => (
                        <CommentItem
                          key={reply.id}
                          comment={reply}
                          onReply={handleReplyToComment}
                          onLike={handleLikeComment}
                          onToggleMenu={handleCommentMenuToggle}
                          onDelete={handleDeleteComment}
                          onTranslate={() => {}}
                          onReport={() => {}}
                          isLiked={isCommentLikedByUser(reply.id)}
                          likesCount={getCommentLikesCount(reply.id)}
                          isMenuOpen={activeCommentMenu?.commentId === reply.id}
                          isOwner={reply.userId === user?.id}
                          currentUser={user}
                          isReply={true}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Formulaire de commentaire */}
        <Card>
          <CardContent className="p-4">
            {replyingTo && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Réponse à @{replyingTo.username}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplyingTo(null);
                      setCommentText("");
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyingTo ? `Répondre à @${replyingTo.username}...` : "Votre commentaire..."}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommentSubmit();
                  }
                }}
              />
              <Button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim() || interactMutation.isPending}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Modal de confirmation de suppression */}
        {deleteConfirmation.show && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Supprimer le commentaire
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
                    Êtes-vous sûr de vouloir supprimer ce commentaire ? Cette action est irréversible.
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 text-sm text-gray-700 dark:text-gray-300 italic">
                    "{deleteConfirmation.commentContent.substring(0, 100)}
                    {deleteConfirmation.commentContent.length > 100 ? '...' : ''}"
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={cancelDeleteComment}
                >
                  Annuler
                </Button>
                <Button
                  onClick={confirmDeleteComment}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

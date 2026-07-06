import { useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import StarRating from "./StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ReviewerType = "renter" | "owner";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  vehicleId: string;
  subjectUserId: string; // the person being reviewed
  reviewerType: ReviewerType;
  contextLabel?: string; // e.g. "Toyota Corolla · 12-15 Mar"
  onSubmitted?: () => void;
  mandatory?: boolean; // when true, dialog cannot be dismissed until submitted
}

const renterSchema = z.object({
  car_condition: z.number().int().min(1).max(5),
  owner_communication: z.number().int().min(1).max(5),
  listing_accuracy: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const ownerSchema = z.object({
  renter_responsibility: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5),
  vehicle_returned_condition: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const ReviewDialog = ({
  open,
  onOpenChange,
  reservationId,
  vehicleId,
  subjectUserId,
  reviewerType,
  contextLabel,
  onSubmitted,
  mandatory = false,
}: ReviewDialogProps) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Renter criteria
  const [carCondition, setCarCondition] = useState(0);
  const [ownerComm, setOwnerComm] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  // Owner criteria
  const [responsibility, setResponsibility] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [returnedCondition, setReturnedCondition] = useState(0);

  const [comment, setComment] = useState("");

  const reset = () => {
    setCarCondition(0);
    setOwnerComm(0);
    setAccuracy(0);
    setResponsibility(0);
    setPunctuality(0);
    setReturnedCondition(0);
    setComment("");
  };

  const submit = async () => {
    if (!user) {
      toast.error("Inicia sesión para dejar tu reseña");
      return;
    }
    setSubmitting(true);
    try {
      let rating: number;
      let payload: Record<string, unknown> = {
        author_id: user.id,
        reservation_id: reservationId,
        vehicle_id: vehicleId,
        subject_user_id: subjectUserId,
        reviewer_type: reviewerType,
        comment: comment.trim() || null,
      };

      if (reviewerType === "renter") {
        const parsed = renterSchema.safeParse({
          car_condition: carCondition,
          owner_communication: ownerComm,
          listing_accuracy: accuracy,
          comment,
        });
        if (!parsed.success) {
          toast.error("Por favor califica los 3 criterios (1 a 5 estrellas)");
          setSubmitting(false);
          return;
        }
        rating = Math.round(
          (carCondition + ownerComm + accuracy) / 3
        );
        payload = {
          ...payload,
          car_condition: carCondition,
          owner_communication: ownerComm,
          listing_accuracy: accuracy,
          rating,
        };
      } else {
        const parsed = ownerSchema.safeParse({
          renter_responsibility: responsibility,
          punctuality,
          vehicle_returned_condition: returnedCondition,
          comment,
        });
        if (!parsed.success) {
          toast.error("Por favor califica los 3 criterios (1 a 5 estrellas)");
          setSubmitting(false);
          return;
        }
        rating = Math.round(
          (responsibility + punctuality + returnedCondition) / 3
        );
        payload = {
          ...payload,
          renter_responsibility: responsibility,
          punctuality,
          vehicle_returned_condition: returnedCondition,
          rating,
        };
      }

      const { error } = await supabase.from("reviews").insert(payload as never);
      if (error) {
        if (error.code === "23505") {
          toast.error("Ya enviaste una reseña para este viaje");
        } else {
          toast.error("No se pudo guardar tu reseña", {
            description: error.message,
          });
        }
        return;
      }

      // Notify the other party that a review was submitted
      await supabase.from("notifications").insert({
        user_id: subjectUserId,
        type: "review_received",
        title: "¡Recibiste una nueva reseña!",
        message: contextLabel
          ? `Reseña sobre tu viaje: ${contextLabel}.`
          : "Han calificado uno de tus viajes.",
        reservation_id: reservationId,
        vehicle_id: vehicleId,
      });

      toast.success("¡Gracias por tu reseña!", {
        description:
          "Será visible públicamente cuando ambas partes hayan calificado o pasen 7 días.",
      });
      reset();
      onSubmitted?.();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isRenter = reviewerType === "renter";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isRenter ? "Califica tu experiencia" : "Califica al arrendatario"}
          </DialogTitle>
          <DialogDescription>
            {contextLabel ? `${contextLabel}. ` : ""}
            Tu reseña será visible cuando la otra parte también califique, o automáticamente después de 7 días.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {isRenter ? (
            <>
              <StarRating
                label="Estado del vehículo"
                value={carCondition}
                onChange={setCarCondition}
              />
              <StarRating
                label="Comunicación del anfitrión"
                value={ownerComm}
                onChange={setOwnerComm}
              />
              <StarRating
                label="Precisión del anuncio"
                value={accuracy}
                onChange={setAccuracy}
              />
            </>
          ) : (
            <>
              <StarRating
                label="Responsabilidad"
                value={responsibility}
                onChange={setResponsibility}
              />
              <StarRating
                label="Puntualidad"
                value={punctuality}
                onChange={setPunctuality}
              />
              <StarRating
                label="Vehículo devuelto en buen estado"
                value={returnedCondition}
                onChange={setReturnedCondition}
              />
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <label
              htmlFor="review-comment"
              className="text-sm font-medium text-foreground"
            >
              Comentario (opcional)
            </label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 1000))}
              placeholder={
                isRenter
                  ? "Cuéntanos cómo fue tu experiencia con este vehículo y anfitrión…"
                  : "¿Cómo fue tu experiencia con este arrendatario?"
              }
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/1000
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Después
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Publicar reseña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewDialog;

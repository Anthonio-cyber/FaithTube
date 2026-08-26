import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from '@faithtube/shared';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Modal, Textarea } from '@/components/ui';
import { Button } from '@/components/ui/Button';

/**
 * Reporting. The first reason offered is "not Christian content", because on
 * this platform that is the report people most need to be able to make.
 */
export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: {
  open: boolean;
  onClose: () => void;
  targetType: 'VIDEO' | 'COMMENT' | 'CHANNEL' | 'USER' | 'LIVESTREAM';
  targetId: string;
  targetLabel: string;
}) {
  const { push } = useToast();
  const [reason, setReason] = useState<ReportReason>('NOT_CHRISTIAN_CONTENT');
  const [details, setDetails] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      api<{ message: string }>('/reports', { method: 'POST', body: { targetType, targetId, reason, details } }),
    onSuccess: (result) => {
      push(result.message ?? 'Thank you. A moderator will review this.', 'success');
      setDetails('');
      onClose();
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Your report could not be sent.', 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report this content"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={submit.isPending} onClick={() => submit.mutate()}>
            Send report
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm ft-muted">
        Reporting <span className="font-medium text-navy dark:text-cream">“{targetLabel}”</span>. Reports go to a human
        moderator. Please only report content that breaks our guidelines — disagreeing with a video is not grounds for a
        report.
      </p>

      <fieldset className="space-y-1.5">
        <legend className="mb-2 text-sm font-medium">What is the problem?</legend>
        {REPORT_REASONS.map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-navy/[0.04] dark:hover:bg-white/5"
          >
            <input
              type="radio"
              name="report-reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              className="h-4 w-4 accent-gold"
            />
            {REPORT_REASON_LABELS[value]}
          </label>
        ))}
      </fieldset>

      <div className="mt-4">
        <label htmlFor="report-details" className="text-sm font-medium">
          Anything else the moderator should know? <span className="ft-muted">(optional)</span>
        </label>
        <Textarea
          id="report-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={2000}
          rows={3}
          className="mt-2"
          placeholder="Timestamps or context help our team review this faster."
        />
      </div>
    </Modal>
  );
}

import { useT } from '../lib/i18n';

/** A parse failure with a position where the parser could give one. */
export interface ErrorLocation {
  message: string;
  line?: number;
  column?: number;
}

/**
 * The syntax-error banner shown above a source view, shared by every parsed
 * kind. A missing line is a supported state, not a degraded one: some parsers
 * (and every XML engine whose wording is unknown to `xmlErrorInfo`) report no
 * position, and the banner then says what is wrong without saying where.
 */
export function ErrorBanner({ format, error }: { format: string; error: ErrorLocation }) {
  const t = useT();
  let where = '';
  if (error.line !== undefined) {
    where =
      error.column !== undefined
        ? t('locLineCol', { line: error.line, column: error.column })
        : t('locLine', { line: error.line });
  }
  return (
    <div className="cfg-error-banner" role="alert">
      <strong>
        {t('syntaxError', { format: format.toUpperCase() })}
        {where}
      </strong>
      <span className="cfg-error-message">{error.message}</span>
    </div>
  );
}

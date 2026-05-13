import { useState, useEffect } from 'react';
import RatingScale from './RatingScale';
import { QUESTIONS, RATINGS } from '../config/questions';

export default function Questionnaire({ imagePreview, onSubmit, onBack, isSubmitting, initialAnswers, initialSeverity = null, initialSignificance = null, initialNotes = '' }) {
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [severity, setSeverity] = useState(initialSeverity);
  const [significance, setSignificance] = useState(initialSignificance);
  const [notes, setNotes] = useState(initialNotes);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setAnswers(initialAnswers || {});
    setSeverity(initialSeverity ?? null);
    setSignificance(initialSignificance ?? null);
    setNotes(initialNotes || '');
    setErrors({});
  }, [initialAnswers, initialSeverity, initialSignificance, initialNotes]);

  function setAnswer(id, value) {
    setAnswers(prev => ({ ...prev, [id]: value }));
    setErrors(prev => ({ ...prev, [id]: undefined }));
  }

  function validate() {
    const newErrors = {};
    for (const q of QUESTIONS) {
      if (q.required && !answers[q.id]) {
        newErrors[q.id] = 'This question is required.';
      }
    }
    if (!severity) newErrors.severity = 'Please select a severity rating.';
    if (!significance) newErrors.significance = 'Please select a significance rating.';
    return newErrors;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstErrorKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstErrorKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSubmit({ answers, severity, significance, notes });
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header with photo thumbnail */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="text-sm text-blue-600 shrink-0">← Retake</button>
          <img src={imagePreview} alt="Captured" className="w-12 h-12 object-cover rounded-lg shrink-0" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Answer about this photo</p>
            <p className="text-xs text-gray-400">Scroll down to complete all questions</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-5 pb-24">
        {/* Dynamic questions */}
        {QUESTIONS.map(q => (
          <div key={q.id} id={`field-${q.id}`} className="card">
            <p className="font-medium text-gray-900 mb-1">
              {q.label}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </p>

            {q.type === 'text' && (
              <textarea
                className="textarea mt-2"
                rows={3}
                placeholder={q.placeholder || ''}
                value={answers[q.id] || ''}
                onChange={e => setAnswer(q.id, e.target.value)}
              />
            )}

            {q.type === 'radio' && (
              <div className="mt-2 space-y-2">
                {q.options.map(opt => (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      answers[q.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswer(q.id, opt)}
                      className="accent-blue-600 w-4 h-4 shrink-0"
                    />
                    <span className="text-sm text-gray-800">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {errors[q.id] && (
              <p className="mt-1 text-sm text-red-600">{errors[q.id]}</p>
            )}
          </div>
        ))}

        {/* Ratings */}
        <div id="field-severity" className="card space-y-6">
          <RatingScale
            label={RATINGS.severity.label}
            description={RATINGS.severity.description}
            lowLabel={RATINGS.severity.low}
            highLabel={RATINGS.severity.high}
            value={severity}
            onChange={v => { setSeverity(v); setErrors(p => ({ ...p, severity: undefined })); }}
          />
          {errors.severity && <p className="text-sm text-red-600">{errors.severity}</p>}

          <div id="field-significance">
            <RatingScale
              label={RATINGS.significance.label}
              description={RATINGS.significance.description}
              lowLabel={RATINGS.significance.low}
              highLabel={RATINGS.significance.high}
              value={significance}
              onChange={v => { setSignificance(v); setErrors(p => ({ ...p, significance: undefined })); }}
            />
            {errors.significance && <p className="text-sm text-red-600">{errors.significance}</p>}
          </div>
        </div>

        {/* Optional notes */}
        <div className="card">
          <label className="label">Additional notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Anything else you'd like to add about this concern..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Uploading...' : 'Submit & Continue'}
        </button>
      </form>
    </div>
  );
}

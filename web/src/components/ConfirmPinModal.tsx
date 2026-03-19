import React, { useEffect, useMemo, useState } from 'react';
import { FinanceMovement } from '../context/PosContext';
import { getFinancePinHash, hashPin, setFinancePinHash, validateFinancePin } from '../utils/financePin';

type ConfirmPinModalProps = {
  movement: FinanceMovement;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export const ConfirmPinModal: React.FC<ConfirmPinModalProps> = ({ movement, onCancel, onConfirm }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [hasExistingPin, setHasExistingPin] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setHasExistingPin(Boolean(getFinancePinHash()));
  }, []);

  const formattedDate = useMemo(() => {
    const date = new Date(movement.date);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [movement.date]);

  const formattedAmount = useMemo(() => {
    const sign = movement.kind === 'entrada' ? '+' : '-';
    return `${sign}$${movement.amount.toFixed(2)}`;
  }, [movement.amount, movement.kind]);

  const handleConfirm = async () => {
    if (hasExistingPin === null) return;
    setError('');
    setIsSubmitting(true);

    try {
      if (!hasExistingPin) {
        if (pin.length < 4) {
          setError('El PIN debe tener al menos 4 dígitos.');
          return;
        }

        if (pin !== confirmPin) {
          setError('Los PIN no coinciden.');
          return;
        }

        const hash = await hashPin(pin);
        setFinancePinHash(hash);
        await onConfirm();
        onCancel();
        return;
      }

      if (!pin) {
        setError('Ingresa tu PIN para continuar.');
        return;
      }

      const isValid = await validateFinancePin(pin);
      if (!isValid) {
        setError('PIN incorrecto. Inténtalo nuevamente.');
        return;
      }

      await onConfirm();
      onCancel();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-coffee/20 p-4">
      <div className="bg-surface rounded-2xl shadow-card w-full max-w-md p-6 space-y-4 border border-borderSoft/80">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-coffee">¿Eliminar movimiento?</p>
          <p className="text-xs text-coffee/70">Esta acción no se puede deshacer.</p>
        </div>

        <div className="rounded-xl border border-borderSoft p-4 bg-butter/20 space-y-1">
          <p className="text-sm font-semibold text-coffee">{movement.concept}</p>
          <p className="text-xs text-coffee/70">{formattedDate}</p>
          <p
            className={`text-sm font-semibold ${
              movement.kind === 'entrada' ? 'text-mintDeep' : 'text-blushDeep'
            }`}
          >
            {formattedAmount}
          </p>
        </div>

        {hasExistingPin === false ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-coffee">Configurar PIN de Finanzas</p>
            <p className="text-xs text-coffee/70">
              Crea un PIN de al menos 4 dígitos. Lo usarás para autorizar eliminaciones en Finanzas.
            </p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
              placeholder="Nuevo PIN"
              minLength={4}
            />
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              className="w-full border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
              placeholder="Repetir PIN"
              minLength={4}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium text-coffee" htmlFor="finance-pin-input">
              Ingresa tu PIN de Finanzas
            </label>
            <input
              id="finance-pin-input"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
              placeholder="PIN"
            />
          </div>
        )}

        {error && <p className="text-sm text-blushDeep">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="btn-primary disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {hasExistingPin === false ? 'Guardar y eliminar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

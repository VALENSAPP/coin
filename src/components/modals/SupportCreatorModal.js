import React from 'react';
import CommonSupportModal from './CommonSupportModal';
import SupportMethodModal from './SupportMethodModal';
import { useLanguage } from '../../i18n';

const SupportCreatorModal = ({
  visible,
  onClose,
  onSupport,
  onTipSupport,
  creatorName = 'Creator',
  variant = 'intro',
  canSupport,
}) => {
  const { t } = useLanguage();

  if (variant === 'disclaimer') {
    return (
      <SupportMethodModal
        visible={visible}
        onClose={onClose}
        creatorName={creatorName}
        onWalletSupport={onSupport}
        onTipSupport={onTipSupport}
        canSupport={canSupport}
      />
    );
  }

  return (
    <CommonSupportModal
      visible={visible}
      onClose={onClose}
      title={t('supportCreator.introTitle')}
      description={t('supportCreator.introDescription', { creatorName })}
      primaryLabel={t('supportCreator.supportNowButton')}
      secondaryLabel={t('supportCreator.nahLater')}
      onPrimary={onSupport}
      onSecondary={onClose}
    />
  );
};

export default SupportCreatorModal;

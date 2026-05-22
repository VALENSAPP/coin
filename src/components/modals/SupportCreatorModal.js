import React from 'react';
import CommonSupportModal from './CommonSupportModal';
import { useLanguage } from '../../i18n';

const SupportCreatorModal = ({
  visible,
  onClose,
  onSupport,
  creatorName = 'Creator',
  variant = 'intro',
  canSupport,
}) => {
  const { t } = useLanguage();

  if (variant === 'disclaimer') {
    return (
      <CommonSupportModal
        visible={visible}
        onClose={onClose}
        title={t('supportCreator.disclaimerTitle', { creatorName })}
        description={t('supportCreator.disclaimerDescription')}
        bullets={[
          t('supportCreator.bullet1'),
          t('supportCreator.bullet2'),
          t('supportCreator.bullet3'),
          t('supportCreator.bullet4'),
          t('supportCreator.bullet5'),
          t('supportCreator.bullet6'),
        ]}
        note={t('supportCreator.disclaimerNote')}
        primaryLabel={t('supportCreator.connectWalletButton')}
        secondaryLabel={t('supportCreator.maybeLater')}
        onPrimary={onSupport}
        onSecondary={onClose}
        canSupport={canSupport}
        variant={variant}
        creatorName={creatorName}
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
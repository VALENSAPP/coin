import React from 'react';
import CommonSupportModal from './CommonSupportModal';

const SupportCreatorModal = ({
  visible,
  onClose,
  onSupport,
  creatorName = 'Creator',
  variant = 'intro',
  canSupport
}) => {
  if (variant === 'disclaimer') {
    return (
      <CommonSupportModal
        visible={visible}
        onClose={onClose}
        title={`Support ${creatorName}`}
        description={"You're about to send voluntary support. Just so you know:"}
        bullets={[
          'This is not an investment.',
          'No profit, rewards, or financial benefits are promised.',
          'The support crypto nft is non- transferable and automatic donated to the user, you can donate many  you want.',
          'Funds move directly from your wallet to the creator\u2019s wallet.',
          'Valens does not hold or manage your funds.',
        ]}
        note="Proceed only if you understand this is a donation."
        primaryLabel="Support Now"
        secondaryLabel="Maybe Later"
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
      title="Support this creator?"
      description={`Your follow is free. If you want, you can financially support ${creatorName} now.`}
      primaryLabel="Support now"
      secondaryLabel="Nah, later"
      onPrimary={onSupport}
      onSecondary={onClose}
    />
  );
};

export default SupportCreatorModal;

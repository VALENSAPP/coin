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
        title={`Support "${creatorName}" ?`}
        description={"You’re about to send voluntary support to this profile.\nJust so you know:"}
        bullets={[
          'This is a non-financial action and not an investment.',
          'No profit, rewards, or financial benefits are expected or offered.',
          'Your support is a voluntary contribution.',
          'Any associated digital item (if applicable) is non-transferable and has no resale value.',
          'Funds are sent directly from your wallet to the creator’s wallet.',
          'Valens does not custody, hold, or manage user funds.'
        ]}
        note="By continuing, you confirm that you understand this is a voluntary contribution with no financial expectation."
        primaryLabel="Connect Wallet to Continue"
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

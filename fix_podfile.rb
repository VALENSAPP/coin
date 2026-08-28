podfile_path = '/Users/amit/Projects/Valens/coin/ios/Podfile'
content = File.read(podfile_path)

unless content.include?("if target.name == 'StripePayments'")
  injection = <<-RUBY
    installer.pods_project.targets.each do |target|
      if target.name == 'StripePayments' || target.name == 'Stripe3DS2'
        target.build_phases.each do |phase|
          if phase.name == 'Headers'
            phase.files.each do |file|
              if file.file_ref.path.include?('Stripe3DS2')
                phase.remove_build_file(file)
              end
            end
          end
        end
      end
    end
RUBY

  content.gsub!(/react_native_post_install\([\s\S]*?\)/) do |match|
    match + "\n\n" + injection
  end

  File.write(podfile_path, content)
end

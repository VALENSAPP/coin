require 'xcodeproj'
project = Xcodeproj::Project.open('ios/Pods/Pods.xcodeproj')
target = project.targets.find { |t| t.name == 'StripePayments' }
if target
  target.headers_build_phase.files.each do |f|
    puts f.file_ref.path
  end
end
